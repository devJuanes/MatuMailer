import { Resolver } from 'dns/promises';
import {
  MATUMAILER_MAIL_HOST,
  MATUMAILER_RELAY_IP,
  normalizeDnsHostname,
  normalizeDnsTxt,
  joinTxtRecords,
  type DnsRecordType,
} from '@matumailer/shared';

/** Resolutor público: el resolver del VPS a veces no ve registros en Cloudflare. */
const publicDns = new Resolver();
publicDns.setServers(
  (process.env.DNS_VERIFY_SERVERS ?? '8.8.8.8,1.1.1.1,8.8.4.4')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export type DnsCheckStatus = 'verified' | 'failed' | 'warning' | 'missing';

export interface DnsCheckResult {
  type: DnsRecordType;
  host: string;
  expected: string;
  purpose: 'spf' | 'dkim' | 'dmarc' | 'mx' | 'return_path';
  found: boolean;
  status: DnsCheckStatus;
  actual: string | null;
  /** Todos los valores detectados en DNS (TXT/MX). */
  detected: string[];
  reason?: string;
  /** Prioridad MX esperada (solo MX). */
  expectedPriority?: number;
}

async function lookupTxt(host: string): Promise<string[]> {
  try {
    const chunks = await publicDns.resolveTxt(host);
    return chunks.map((parts) => parts.join(''));
  } catch {
    return [];
  }
}

async function lookupMx(host: string): Promise<Array<{ exchange: string; priority: number }>> {
  try {
    return await publicDns.resolveMx(host);
  } catch {
    return [];
  }
}

async function lookupCname(host: string): Promise<string | null> {
  try {
    const targets = await publicDns.resolveCname(host);
    return targets[0] ?? null;
  } catch {
    return null;
  }
}

function txtContains(values: string[], needle: string): boolean {
  const target = normalizeDnsTxt(needle);
  if (!target) return false;
  const joined = joinTxtRecords(values);
  if (joined.includes(target)) return true;
  return values.some((v) => normalizeDnsTxt(v).includes(target));
}

function txtStartsWith(values: string[], prefix: string): boolean {
  const p = normalizeDnsTxt(prefix);
  const joined = joinTxtRecords(values);
  return joined.startsWith(p) || values.some((v) => normalizeDnsTxt(v).startsWith(p));
}

function findSpfRecord(values: string[]): string | null {
  for (const v of values) {
    if (/v=spf1/i.test(v)) return v;
  }
  const joined = values.join('');
  if (/v=spf1/i.test(joined)) return joined;
  return null;
}

function countSpfRecords(values: string[]): number {
  return values.filter((v) => /v=spf1/i.test(v)).length;
}

function formatMxList(records: Array<{ exchange: string; priority: number }>): string[] {
  return records
    .sort((a, b) => a.priority - b.priority)
    .map((r) => `${r.priority} ${normalizeDnsHostname(r.exchange)}`);
}

export interface CheckDomainDnsOpts {
  domain: string;
  dkimSelector: string;
  dkimPublicKey: string;
  mailHost?: string;
  relayIp?: string;
  returnPathHost?: string;
  returnPathTarget?: string;
  mxHost?: string;
  mxTarget?: string;
  mxPriority?: number;
}

/** Verifica SPF, DKIM, DMARC, MX y return-path CNAME contra DNS público. */
export async function checkDomainDns(opts: CheckDomainDnsOpts): Promise<DnsCheckResult[]> {
  const mailHost = opts.mailHost ?? MATUMAILER_MAIL_HOST;
  const relayIp = opts.relayIp ?? MATUMAILER_RELAY_IP;
  const mxTarget = normalizeDnsHostname(opts.mxTarget ?? mailHost);
  const results: DnsCheckResult[] = [];

  // --- SPF (apex TXT) ---
  const spfHost = opts.domain;
  const spfTxts = await lookupTxt(spfHost);
  const spfNeedle = `ip4:${relayIp}`;
  const spfAltNeedle = normalizeDnsHostname(mailHost);
  const spfFound =
    txtContains(spfTxts, spfNeedle) ||
    spfTxts.some((v) => normalizeDnsTxt(v).includes(`a:${spfAltNeedle}`));
  const spfCount = countSpfRecords(spfTxts);
  const spfRecord = findSpfRecord(spfTxts);
  let spfReason: string | undefined;
  let spfStatus: DnsCheckStatus = spfFound ? 'verified' : 'missing';
  if (spfFound && spfCount > 1) {
    spfStatus = 'warning';
    spfReason = `Hay ${spfCount} registros SPF en el apex. Solo debe haber uno; combínalos o elimina duplicados (p. ej. "v=spf1 -all").`;
  } else if (!spfFound) {
    spfReason = spfTxts.length
      ? `No encontramos autorización MatuMailer (${spfNeedle} o a:${mailHost}) en el SPF del dominio.`
      : 'No hay registros TXT en el apex del dominio.';
  }

  results.push({
    type: 'TXT',
    host: spfHost,
    expected: `v=spf1 ip4:${relayIp} a:${mailHost} ~all`,
    purpose: 'spf',
    found: spfFound,
    status: spfStatus,
    actual: spfRecord,
    detected: spfTxts,
    reason: spfReason,
  });

  // --- DKIM ---
  const dkimHost = `${opts.dkimSelector}._domainkey.${opts.domain}`;
  const dkimTxts = await lookupTxt(dkimHost);
  const dkimExpected = `v=DKIM1; k=rsa; p=${opts.dkimPublicKey}`;
  const dkimNeedle = normalizeDnsTxt(`p=${opts.dkimPublicKey}`);
  const dkimJoined = joinTxtRecords(dkimTxts);
  const dkimFound = txtContains(dkimTxts, dkimExpected) || dkimJoined.includes(dkimNeedle);
  let dkimReason: string | undefined;
  if (!dkimFound) {
    if (!dkimTxts.length) {
      dkimReason = `No existe el TXT DKIM en ${dkimHost}. Créalo en tu DNS con el valor exacto de MatuMailer.`;
    } else if (dkimJoined.includes('v=dkim1') && !dkimJoined.includes(dkimNeedle)) {
      dkimReason =
        'El registro DKIM existe, pero la clave pública no coincide con la generada por MatuMailer. Copia de nuevo el valor o pulsa "Actualizar registros DNS".';
    } else {
      dkimReason = 'No encontramos un DKIM válido (v=DKIM1; k=rsa; p=...) en ese host.';
    }
  }

  results.push({
    type: 'TXT',
    host: dkimHost,
    expected: dkimExpected,
    purpose: 'dkim',
    found: dkimFound,
    status: dkimFound ? 'verified' : 'failed',
    actual: dkimTxts.length ? dkimTxts.join('') : null,
    detected: dkimTxts,
    reason: dkimReason,
  });

  // --- DMARC ---
  const dmarcHost = `_dmarc.${opts.domain}`;
  const dmarcTxts = await lookupTxt(dmarcHost);
  const dmarcFound = txtStartsWith(dmarcTxts, 'v=DMARC1');
  results.push({
    type: 'TXT',
    host: dmarcHost,
    expected: 'v=DMARC1; p=none; ...',
    purpose: 'dmarc',
    found: dmarcFound,
    status: dmarcFound ? 'verified' : 'warning',
    actual: dmarcTxts[0] ?? null,
    detected: dmarcTxts,
    reason: dmarcFound
      ? undefined
      : 'DMARC no encontrado. Recomendado para entregabilidad; no bloquea el envío.',
  });

  // --- MX ---
  if (opts.mxHost && opts.mxTarget) {
    const mxRecords = await lookupMx(opts.mxHost);
    const matumailerMx = mxRecords.filter((r) => normalizeDnsHostname(r.exchange) === mxTarget);
    const otherMx = mxRecords.filter((r) => normalizeDnsHostname(r.exchange) !== mxTarget);
    const mxFound = matumailerMx.length > 0;
    const mxFormatted = formatMxList(mxRecords);
    let mxStatus: DnsCheckStatus = mxFound ? 'verified' : 'missing';
    let mxReason: string | undefined;

    if (mxFound && otherMx.length > 0) {
      mxStatus = 'warning';
      const others = otherMx
        .map((r) => `${normalizeDnsHostname(r.exchange)} (prio ${r.priority})`)
        .join(', ');
      mxReason = `MatuMailer MX detectado, pero también hay otros: ${others}. Para recibir solo en MatuMailer, elimina los MX de Zoho/otros proveedores.`;
    } else if (!mxFound) {
      mxReason = mxRecords.length
        ? `No hay MX apuntando a ${mailHost}. Detectados: ${mxFormatted.join('; ')}`
        : `No hay registros MX en ${opts.mxHost}. Añade MX → ${mailHost} prioridad ${opts.mxPriority ?? 10}.`;
    }

    results.push({
      type: 'MX',
      host: opts.mxHost,
      expected: `${mailHost} (prioridad ${opts.mxPriority ?? 10})`,
      purpose: 'mx',
      found: mxFound,
      status: mxStatus,
      actual: mxFormatted.join('; ') || null,
      detected: mxFormatted,
      reason: mxReason,
      expectedPriority: opts.mxPriority ?? 10,
    });
  }

  // --- Return-path CNAME ---
  if (opts.returnPathHost && opts.returnPathTarget) {
    const cnameTarget = await lookupCname(opts.returnPathHost);
    const expected = normalizeDnsHostname(opts.returnPathTarget);
    const actualNorm = cnameTarget ? normalizeDnsHostname(cnameTarget) : null;
    const cnameFound = actualNorm === expected;
    let cnameReason: string | undefined;
    if (!cnameFound) {
      cnameReason = cnameTarget
        ? `CNAME apunta a ${cnameTarget}, debería ser ${opts.returnPathTarget}.`
        : `No encontramos CNAME en ${opts.returnPathHost}. Añade CNAME → ${opts.returnPathTarget} (return-path / rebotes).`;
    }

    results.push({
      type: 'CNAME',
      host: opts.returnPathHost,
      expected: opts.returnPathTarget,
      purpose: 'return_path',
      found: cnameFound,
      status: cnameFound ? 'verified' : 'failed',
      actual: cnameTarget,
      detected: cnameTarget ? [cnameTarget] : [],
      reason: cnameReason,
    });
  }

  return results;
}
