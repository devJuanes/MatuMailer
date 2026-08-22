import type { DomainDnsRecord } from '@matumailer/shared';
import type { DnsCheckResult } from './domain-dns.js';

export type DomainCapability = 'ready' | 'pending' | 'warning' | 'blocked';

export interface DomainCapabilities {
  sending: DomainCapability;
  receiving: DomainCapability;
  dmarc: DomainCapability;
}

export interface VerificationSummary {
  /** Puede enviar correo (SPF + DKIM). */
  sendingReady: boolean;
  /** MX de MatuMailer presente y sin conflicto grave. */
  receivingReady: boolean;
  /** Todo verificado incl. return-path y MX limpio. */
  fullyVerified: boolean;
  capabilities: DomainCapabilities;
  warnings: string[];
  blockingIssues: string[];
  message: string;
}

function capFromCheck(
  found: boolean,
  status: DnsCheckResult['status'],
  required: boolean,
): DomainCapability {
  if (found && status === 'verified') return 'ready';
  if (found && status === 'warning') return 'warning';
  if (!found && !required) return status === 'warning' ? 'warning' : 'pending';
  return 'blocked';
}

export function summarizeVerification(
  checks: DnsCheckResult[],
  records: DomainDnsRecord[],
): VerificationSummary {
  const byPurpose = (p: DnsCheckResult['purpose']) => checks.find((c) => c.purpose === p);

  const spf = byPurpose('spf');
  const dkim = byPurpose('dkim');
  const dmarc = byPurpose('dmarc');
  const mx = byPurpose('mx');
  const rp = byPurpose('return_path');

  const sendingReady = !!(spf?.found && dkim?.found);
  const mxOk = !!mx?.found;
  const mxClean = mxOk && mx?.status !== 'warning';
  const receivingReady = mxOk;
  const returnPathOk = rp?.found ?? true;

  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  for (const c of checks) {
    if (c.reason && c.status === 'warning') warnings.push(c.reason);
    if (!c.found && (c.purpose === 'spf' || c.purpose === 'dkim')) {
      blockingIssues.push(c.reason ?? `${c.type} ${c.host} no verificado`);
    }
    if (!c.found && c.purpose === 'return_path') {
      blockingIssues.push(c.reason ?? `CNAME return-path faltante`);
    }
    if (!c.found && c.purpose === 'mx') {
      blockingIssues.push(c.reason ?? `MX de MatuMailer faltante`);
    }
  }

  if (mx?.status === 'warning' && mx.reason) warnings.push(mx.reason);
  if (spf?.status === 'warning' && spf.reason) warnings.push(spf.reason);

  const recordChecksOk = records
    .filter((r) => ['TXT', 'CNAME', 'MX'].includes(r.type))
    .every((r) => {
      const c = checks.find(
        (ch) => ch.type === r.type && ch.host.toLowerCase() === r.host.toLowerCase(),
      );
      return c?.found ?? false;
    });

  const fullyVerified = sendingReady && returnPathOk && mxClean && recordChecksOk;

  const capabilities: DomainCapabilities = {
    sending: capFromCheck(!!spf?.found && !!dkim?.found, spf?.status ?? 'failed', true),
    receiving: mx
      ? capFromCheck(mx.found, mx.status, false)
      : sendingReady
        ? 'pending'
        : 'blocked',
    dmarc: capFromCheck(!!dmarc?.found, dmarc?.status ?? 'warning', false),
  };

  let message: string;
  if (fullyVerified) {
    message = 'Dominio verificado. Listo para enviar y recibir.';
  } else if (sendingReady && !receivingReady) {
    message =
      'Listo para enviar. Para recibir en la bandeja, configura MX → matumailer.matubyte.com (prioridad 10).';
  } else if (sendingReady && receivingReady && !returnPathOk) {
    message =
      'Envío y recepción MX OK. Falta el CNAME de return-path; añádelo para alinear rebotes.';
  } else if (sendingReady && warnings.length) {
    message = `Envío autorizado con advertencias: ${warnings[0]}`;
  } else if (blockingIssues.length) {
    message = blockingIssues.slice(0, 2).join(' ');
  } else {
    message = 'Revisa los registros DNS pendientes en la tabla.';
  }

  return {
    sendingReady,
    receivingReady,
    fullyVerified,
    capabilities,
    warnings,
    blockingIssues,
    message,
  };
}

/** Estado del dominio: verified si puede enviar; failed si no. */
export function domainStatusFromSummary(summary: VerificationSummary): 'verified' | 'failed' {
  return summary.sendingReady ? 'verified' : 'failed';
}

export function recordStatusFromCheck(check: DnsCheckResult | undefined): 'verified' | 'failed' | 'pending' {
  if (!check) return 'pending';
  if (check.found) return check.status === 'failed' ? 'failed' : 'verified';
  return 'failed';
}
