import { readFileSync, existsSync } from 'node:fs';
import { resolveMx } from 'dns/promises';
import { aliasesRepo, domainsRepo } from '@matumailer/database';
import {
  MATUMAILER_MAIL_HOST,
  MATUMAILER_RELAY_IP,
  normalizeDnsHostname,
} from '@matumailer/shared';
import { checkDomainDns } from './domain-dns.js';
import { summarizeVerification } from './domain-verification.js';

export interface MailboxReceivingStatus {
  email: string;
  localPart: string;
  isActive: boolean;
  inPostfixMap: boolean | null;
  ready: boolean;
  reason?: string;
}

export interface DomainDiagnostics {
  domain: string;
  domainId: string;
  domainStatus: string;
  dns: ReturnType<typeof summarizeVerification>;
  mx: {
    records: Array<{ priority: number; host: string }>;
    matumailerPresent: boolean;
    otherProviders: string[];
    pointsToMatuMailer: boolean;
  };
  mailboxes: MailboxReceivingStatus[];
  postfix: {
    mapsReadable: boolean;
    mapPath: string | null;
    domainInMap: boolean | null;
    syncedAliasCount: number | null;
  };
  inbound: {
    pipeline: string;
    explanation: string;
    likely550Cause: string | null;
  };
  deliverability: {
    mailHost: string;
    relayIp: string;
    heloHost: string;
    notes: string[];
  };
  receivingReady: boolean;
  sendingReady: boolean;
}

function readPostfixMailboxes(mapDir: string): Map<string, string> | null {
  const path = `${mapDir}/matumailer_mailboxes`;
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const map = new Map<string, string>();
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const [email, dest] = t.split(/\s+/, 2);
      if (email) map.set(email.toLowerCase(), dest ?? '');
    }
    return map;
  } catch {
    return null;
  }
}

function readPostfixDomains(mapDir: string): Set<string> | null {
  const path = `${mapDir}/matumailer_domains`;
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const set = new Set<string>();
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim().split(/\s+/)[0];
      if (t) set.add(t.toLowerCase());
    }
    return set;
  } catch {
    return null;
  }
}

export async function buildDomainDiagnostics(domainId: string): Promise<DomainDiagnostics | null> {
  const domain = await domainsRepo.findDomainWithRecords(domainId);
  if (!domain) return null;

  const aliases = await aliasesRepo.listAliases(domain.project_id, { domainId: domain.id });
  const mapDir = process.env.POSTFIX_MAP_DIR || '/etc/postfix';
  const mailboxMap = readPostfixMailboxes(mapDir);
  const domainMap = readPostfixDomains(mapDir);

  let mxRecords: Array<{ priority: number; host: string }> = [];
  try {
    const mx = await resolveMx(domain.domain);
    mxRecords = mx
      .map((r) => ({ priority: r.priority, host: normalizeDnsHostname(r.exchange) }))
      .sort((a, b) => a.priority - b.priority);
  } catch {
    mxRecords = [];
  }

  const matumailerHost = normalizeDnsHostname(MATUMAILER_MAIL_HOST);
  const matumailerMx = mxRecords.filter((r) => r.host === matumailerHost);
  const otherMx = mxRecords.filter((r) => r.host !== matumailerHost);

  const checks = await checkDomainDns({
    domain: domain.domain,
    dkimSelector: domain.dkim_selector,
    dkimPublicKey: domain.dkim_public_key,
    mailHost: MATUMAILER_MAIL_HOST,
    relayIp: MATUMAILER_RELAY_IP,
    mxHost: domain.domain,
    mxTarget: MATUMAILER_MAIL_HOST,
    mxPriority: 10,
    returnPathHost: `${domain.return_path_subdomain}.${domain.domain}`,
    returnPathTarget: MATUMAILER_MAIL_HOST,
  });
  const dnsSummary = summarizeVerification(checks, domain.records);

  const mailboxes: MailboxReceivingStatus[] = aliases.map((a) => {
    const email = a.full_email.toLowerCase();
    const inMap = mailboxMap ? mailboxMap.has(email) : null;
    let reason: string | undefined;
    let ready = false;

    if (!a.is_active) {
      reason = 'Alias desactivado en MatuMailer.';
    } else if (domain.status !== 'verified') {
      reason = 'Dominio no verificado; Postfix no incluye este dominio.';
    } else if (inMap === false) {
      reason =
        'El alias existe en MatuMailer pero NO está en /etc/postfix/matumailer_mailboxes. Ejecuta: sudo node scripts/sync-postfix-inbound.mjs';
    } else if (matumailerMx.length === 0) {
      reason = `MX de ${MATUMAILER_MAIL_HOST} no detectado en DNS público.`;
    } else if (otherMx.some((o) => o.priority <= (matumailerMx[0]?.priority ?? 10))) {
      reason = `Hay MX de otros proveedores (${otherMx.map((o) => o.host).join(', ')}). Parte del correo puede ir a Zoho/otro y no a MatuMailer.`;
      ready = inMap === true && a.is_active && domain.status === 'verified';
    } else if (inMap === true && a.is_active && domain.status === 'verified') {
      ready = true;
    } else if (inMap === null) {
      reason = 'No se pudo leer el mapa Postfix (¿permisos?). Verifica en el servidor.';
      ready = a.is_active && domain.status === 'verified';
    }

    return {
      email,
      localPart: a.local_part,
      isActive: a.is_active,
      inPostfixMap: inMap,
      ready,
      reason,
    };
  });

  const domainInMap = domainMap ? domainMap.has(domain.domain.toLowerCase()) : null;
  const syncedCount = mailboxMap
    ? [...mailboxMap.keys()].filter((e) => e.endsWith(`@${domain.domain.toLowerCase()}`)).length
    : null;

  let likely550: string | null = null;
  if (mailboxes.length === 0) {
    likely550 =
      'No hay aliases (buzones) creados. Crea agenda@grupohuacas.com en MatuMailer → Aliases. Sin alias, Postfix responde 550 en RCPT TO.';
  } else {
    const missing = mailboxes.filter((m) => m.isActive && m.inPostfixMap === false);
    if (missing.length) {
      likely550 = `Postfix rechaza RCPT TO porque estos aliases no están en matumailer_mailboxes: ${missing.map((m) => m.email).join(', ')}. Sincroniza Postfix.`;
    } else if (matumailerMx.length === 0) {
      likely550 = `El MX no apunta a ${MATUMAILER_MAIL_HOST}. El correo nunca llega a nuestro Postfix.`;
    } else if (otherMx.length && otherMx.some((o) => o.priority <= (matumailerMx[0]?.priority ?? 10))) {
      likely550 = `MX compartido con ${otherMx.map((o) => o.host).join(', ')}. Si Zoho recibe primero, responderá 550 si el buzón no existe allí.`;
    }
  }

  const heloHost = process.env.MATUMAILER_HELO_HOST || MATUMAILER_MAIL_HOST;
  const deliverabilityNotes = [
    'Verifica PTR/rDNS de la IP de envío apuntando a un hostname coherente (ej. matumailer.matubyte.com).',
    'Postfix myhostname debe ser un FQDN válido (no localhost).',
    'matumailer.matubyte.com debe ser DNS-only (sin proxy Cloudflare) para SMTP.',
    'Puerto TCP 25 debe estar abierto en el firewall del VPS para recepción.',
  ];

  const receivingReady =
    dnsSummary.receivingReady &&
    mailboxes.some((m) => m.ready) &&
    (domainInMap !== false);

  return {
    domain: domain.domain,
    domainId: domain.id,
    domainStatus: domain.status,
    dns: dnsSummary,
    mx: {
      records: mxRecords,
      matumailerPresent: matumailerMx.length > 0,
      otherProviders: otherMx.map((o) => `${o.host} (prio ${o.priority})`),
      pointsToMatuMailer: matumailerMx.length > 0,
    },
    mailboxes,
    postfix: {
      mapsReadable: mailboxMap !== null,
      mapPath: mailboxMap ? `${mapDir}/matumailer_mailboxes` : null,
      domainInMap,
      syncedAliasCount: syncedCount,
    },
    inbound: {
      pipeline:
        'Internet → MX → Postfix :25 → virtual_mailbox_maps → pipe → /api/inbound/ingest → inbox',
      explanation:
        'El 550 5.1.1 se genera en Postfix cuando RCPT TO no está en matumailer_mailboxes (unknown_virtual_mailbox_reject_code=550). Nodemailer NO recibe correo.',
      likely550Cause: likely550,
    },
    deliverability: {
      mailHost: MATUMAILER_MAIL_HOST,
      relayIp: MATUMAILER_RELAY_IP,
      heloHost,
      notes: deliverabilityNotes,
    },
    receivingReady,
    sendingReady: dnsSummary.sendingReady,
  };
}
