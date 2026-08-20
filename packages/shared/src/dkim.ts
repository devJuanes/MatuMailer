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

/** Valor DNS esperado para SPF (incluye el relay de MatuMailer). */
export function buildSpfTxtValue(opts: { includeRelay?: boolean } = {}): string {
  const parts = ['v=spf1'];
  if (opts.includeRelay) parts.push('include:_spf.matumailer.com');
  parts.push('~all');
  return parts.join(' ');
}

/** Valor DNS DMARC por defecto (modo monitor + reporting). */
export function buildDmarcTxtValue(opts: { reportEmail?: string; subdomainPolicy?: string } = {}): {
  host: string;
  value: string;
} {
  const report = opts.reportEmail ?? 'dmarc-reports@matumailer.com';
  const sp = opts.subdomainPolicy ?? 'sp=none';
  const value = `v=DMARC1; p=none; ${sp}; rua=mailto:${report}; ruf=mailto:${report}; fo=1; aspf=r; adkim=r`;
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

/** CNAME destino del return-path: feedback.<region>.matumailer.com */
export function returnPathTarget(region: string): string {
  return `feedback.${region}.matumailer.com`;
}

/** MX de recepción: apunta al servidor MatuMailer (Postfix inbound). */
export function buildMxRecords(opts: { region: string; priority?: number }): Array<{
  host: string;
  value: string;
  priority: number;
}> {
  void opts.region;
  return [
    {
      host: '@',
      value: 'matumailer.matubyte.com',
      priority: opts.priority ?? 10,
    },
  ];
}
