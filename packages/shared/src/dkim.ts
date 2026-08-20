import { createHash, generateKeyPairSync } from 'crypto';

export interface DkimKeyPair {
  /** Selector DNS (ej. mm202401). */
  selector: string;
  /** Clave pública en base64 (sin encabezados PEM). */
  publicKey: string;
  /** Clave privada en formato PEM (PKCS#8). Se cifra antes de persistir. */
  privateKeyPem: string;
  /** Huella para fingerprint. */
  fingerprint: string;
}

/** Host público de MatuMailer (envío + recepción). */
export const MATUMAILER_MAIL_HOST =
  process.env.MATUMAILER_MAIL_HOST?.trim() || 'matumailer.matubyte.com';

/** IP pública del relay (SPF). */
export const MATUMAILER_RELAY_IP = process.env.MATUMAILER_RELAY_IP?.trim() || '13.140.160.248';

const SELECTOR_PREFIX = 'mm';

function randomSelector(): string {
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${SELECTOR_PREFIX}${yyyymm}${rand}`;
}

/** Genera par RSA 2048 listo para DKIM (clave pública en base64, privada en PEM). */
export function generateDkimKeyPair(selector?: string): DkimKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const publicKeyBase64 = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');

  const fingerprint = createHash('sha256').update(publicKeyBase64).digest('hex').slice(0, 32);

  return {
    selector: selector ?? randomSelector(),
    publicKey: publicKeyBase64,
    privateKeyPem: privateKey,
    fingerprint,
  };
}

/** Valor DNS esperado para un registro DKIM TXT. */
export function buildDkimTxtValue(publicKey: string): string {
  return `v=DKIM1; k=rsa; p=${publicKey}`;
}

/**
 * SPF: autoriza la IP del relay MatuMailer.
 * No usamos include:_spf.matumailer.com — ese host no existe.
 */
export function buildSpfTxtValue(_opts: { includeRelay?: boolean } = {}): string {
  return `v=spf1 ip4:${MATUMAILER_RELAY_IP} a:${MATUMAILER_MAIL_HOST} ~all`;
}

/** Valor DNS DMARC por defecto (modo monitor + reporting). */
export function buildDmarcTxtValue(opts: { reportEmail?: string; subdomainPolicy?: string } = {}): {
  host: string;
  value: string;
} {
  const reportEmail =
    opts.reportEmail ??
    (MATUMAILER_MAIL_HOST.includes('matubyte.com')
      ? 'dmarc@matubyte.com'
      : `dmarc@${MATUMAILER_MAIL_HOST}`);
  const sp = opts.subdomainPolicy ?? 'sp=none';
  const value = `v=DMARC1; p=none; ${sp}; rua=mailto:${reportEmail}; ruf=mailto:${reportEmail}; fo=1; aspf=r; adkim=r`;
  return { host: '_dmarc', value };
}

/** Host para el registro DKIM: <selector>._domainkey.<domain> */
export function dkimHost(domain: string, selector: string): string {
  return `${selector}._domainkey.${domain}`;
}

/** Host para SPF: raíz del dominio. */
export function spfHost(domain: string): string {
  return domain;
}

/** Host para DMARC: _dmarc.<domain>. */
export function dmarcHost(domain: string): string {
  return `_dmarc.${domain}`;
}

/** Host CNAME de return-path (bounce handling). */
export function returnPathHost(returnPathSubdomain: string, domain: string): string {
  return `${returnPathSubdomain}.${domain}`;
}

/** CNAME destino del return-path → host real de MatuMailer. */
export function returnPathTarget(_region: string): string {
  return MATUMAILER_MAIL_HOST;
}

/** MX de recepción: apex del dominio → matumailer.matubyte.com */
export function buildMxRecords(opts: { region: string; priority?: number }): Array<{
  host: string;
  value: string;
  priority: number;
}> {
  void opts.region;
  return [
    {
      host: '@',
      value: MATUMAILER_MAIL_HOST,
      priority: opts.priority ?? 10,
    },
  ];
}

/** True si el valor DNS apunta a infraestructura muerta (matumailer.com sin matubyte). */
export function isStaleMatumailerDnsValue(value: string): boolean {
  const v = value.toLowerCase();
  if (v.includes('matubyte.com')) return false;
  return (
    v.includes('matumailer.com') ||
    v.includes('_spf.matumailer') ||
    v.includes('mx.us-east') ||
    v.includes('feedback.us-east')
  );
}

export function buildDomainDnsRecordList(opts: {
  domain: string;
  region: string;
  dkimSelector: string;
  dkimPublicKey: string;
  returnPathSubdomain: string;
}): Array<{
  type: 'TXT' | 'CNAME' | 'MX';
  host: string;
  value: string;
  priority: number | null;
}> {
  const dmarc = buildDmarcTxtValue();
  const dkimValue = buildDkimTxtValue(opts.dkimPublicKey);
  const spfValue = buildSpfTxtValue({ includeRelay: true });

  return [
    {
      type: 'TXT',
      host: opts.domain,
      value: spfValue,
      priority: null,
    },
    {
      type: 'TXT',
      host: dkimHost(opts.domain, opts.dkimSelector),
      value: dkimValue,
      priority: null,
    },
    {
      type: 'TXT',
      host: `${dmarc.host}.${opts.domain}`,
      value: dmarc.value,
      priority: null,
    },
    {
      type: 'CNAME',
      host: returnPathHost(opts.returnPathSubdomain, opts.domain),
      value: returnPathTarget(opts.region),
      priority: null,
    },
    ...buildMxRecords({ region: opts.region }).map((m) => ({
      type: 'MX' as const,
      host: m.host === '@' ? opts.domain : m.host,
      value: m.value,
      priority: m.priority,
    })),
  ];
}
