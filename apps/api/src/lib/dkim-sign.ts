import { createHash, createSign, randomBytes } from 'crypto';

export interface DkimSignOptions {
  /** Selector DNS (ej. mm202401) */
  selector: string;
  /** Dominio firmante (ej. destin.com) */
  domain: string;
  /** Clave privada en formato PEM (PKCS#8) */
  privateKey: string;
  /** Cabeceras a firmar en orden (los habituales). */
  headers?: string[];
  /** Tiempo de expiración en segundos (default 5 minutos). */
  expirationSeconds?: number;
  /** Timestamp de firma en segundos (default now). */
  timestamp?: number;
}

const DEFAULT_SIGNED_HEADERS = [
  'from',
  'to',
  'cc',
  'subject',
  'date',
  'message-id',
  'mime-version',
  'content-type',
  'content-transfer-encoding',
  'reply-to',
  'list-unsubscribe',
  'list-unsubscribe-post',
  'feedback-id',
  'in-reply-to',
  'references',
];

interface ParsedHeader {
  name: string;
  value: string;
}

/** Divide un mensaje en cabeceras y body preservando CRLF. */
export function splitHeaders(message: string): { headers: ParsedHeader[]; body: string } {
  const normalized = message.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  const idx = normalized.indexOf('\r\n\r\n');
  if (idx === -1) return { headers: [], body: normalized };
  const head = normalized.slice(0, idx);
  const body = normalized.slice(idx + 4);
  const headers: ParsedHeader[] = [];

  for (const line of head.split('\r\n')) {
    if (!line.trim()) continue;
    if (/^\s/.test(line) && headers.length > 0) {
      headers[headers.length - 1].value += ' ' + line.trim();
      continue;
    }
    const m = line.match(/^([!-9;-~]+):\s?(.*)$/);
    if (m) headers.push({ name: m[1].toLowerCase(), value: m[2] });
  }
  return { headers, body };
}

function canonicalizeHeader(name: string, value: string, mode: 'relaxed' | 'simple'): string {
  let v = value;
  if (mode === 'relaxed') {
    v = v.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  } else {
    v = v.replace(/\s+$/g, '');
  }
  return `${name}:${v}`;
}

function canonicalizeBodyRelaxed(body: string): string {
  let b = body;
  if (!b.endsWith('\r\n')) b += '\r\n';
  b = b
    .replace(/[ \t]+(?=\r\n)/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '\r\n');
  while (b.endsWith('\r\n\r\n')) b = b.slice(0, -2);
  return b;
}

function hashBody(body: string): string {
  return createHash('sha256').update(canonicalizeBodyRelaxed(body)).digest('base64');
}

function foldHeader(value: string): string {
  if (value.length <= 72) return value;
  const lines: string[] = [];
  let remaining = value;
  while (remaining.length > 72) {
    lines.push(remaining.slice(0, 72));
    remaining = ' ' + remaining.slice(72);
  }
  if (remaining.trim()) lines.push(remaining);
  return lines.join('\r\n');
}

/**
 * Firma un mensaje MIME con DKIM (modo relaxed/relaxed) y devuelve la
 * cabecera DKIM-Signature para añadir a las cabeceras del mensaje.
 */
export function signDkim(message: string, opts: DkimSignOptions): string {
  const { headers } = splitHeaders(message);
  const signedHeaders = opts.headers ?? DEFAULT_SIGNED_HEADERS;
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  // Sin expiración corta: 7 días. Una x= de 5 min invalidaba firmas en cola/deferral.
  const expires = timestamp + (opts.expirationSeconds ?? 7 * 24 * 3600);

  const presentHeaders = signedHeaders.filter((h) => headers.some((hd) => hd.name === h));
  if (!presentHeaders.includes('from')) {
    throw new Error('El mensaje debe contener cabecera "From" para firmar DKIM');
  }

  const body = message.slice(message.indexOf('\r\n\r\n') + 4);
  const bodyHash = hashBody(body);

  const canonicalizedHeaders = presentHeaders
    .map((h) => canonicalizeHeader(h, headers.find((hd) => hd.name === h)!.value, 'relaxed'))
    .join('\r\n');

  const dkimHeaderValue =
    `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${opts.domain}; s=${opts.selector}; ` +
    `t=${timestamp}; x=${expires}; h=${presentHeaders.join(':')}; ` +
    `bh=${bodyHash}; b=`;

  // RFC 6376: headers firmados primero, luego DKIM-Signature con b= vacío.
  const signedData = [
    canonicalizedHeaders,
    canonicalizeHeader('dkim-signature', dkimHeaderValue, 'relaxed'),
  ].join('\r\n');

  const signer = createSign('RSA-SHA256');
  signer.update(signedData);
  signer.end();
  const signature = signer.sign(opts.privateKey).toString('base64');

  return foldHeader(`DKIM-Signature: ${dkimHeaderValue}${signature}`);
}

/**
 * Versión simplificada: firma un objeto con headers + body separados.
 * Útil para tests y para integrarse en flujos que ya tienen headers separados.
 */
export function buildDkimHeaderValue(opts: {
  selector: string;
  domain: string;
  privateKey: string;
  canonicalizedHeaders: string;
  bodyHash: string;
  signedHeaders: string[];
  timestamp?: number;
  expirationSeconds?: number;
}): string {
  const ts = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const exp = ts + (opts.expirationSeconds ?? 7 * 24 * 3600);
  const baseTag =
    `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${opts.domain}; s=${opts.selector}; ` +
    `t=${ts}; x=${exp}; h=${opts.signedHeaders.join(':')}; bh=${opts.bodyHash}; b=`;
  const signer = createSign('RSA-SHA256');
  // Headers canónicos primero, luego dkim-signature (RFC 6376).
  signer.update(
    `${opts.canonicalizedHeaders}\r\n${canonicalizeHeader('dkim-signature', baseTag, 'relaxed')}`,
  );
  signer.end();
  return baseTag + signer.sign(opts.privateKey).toString('base64');
}

/** Genera un Message-ID único para un dominio. */
export function buildMessageId(domain: string): string {
  const id = randomBytes(16).toString('hex');
  return `<${id}@${domain}>`;
}
