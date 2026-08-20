/** Errores de resolución de identidad de envío (códigos estables para API/SDK). */

export const SENDING_IDENTITY_ERROR_CODES = [
  'SENDING_IDENTITY_NOT_FOUND',
  'SENDING_IDENTITY_NOT_VERIFIED',
  'SENDING_IDENTITY_NOT_ALLOWED',
  'SENDING_IDENTITY_DISABLED',
  'DOMAIN_NOT_VERIFIED',
  'DOMAIN_NOT_FOUND',
  'DOMAIN_NOT_ALLOWED_FOR_PROJECT',
  'NO_DEFAULT_SENDING_IDENTITY',
  'NO_VERIFIED_DOMAIN',
  'NO_ALIAS_ON_DOMAIN',
] as const;

export type SendingIdentityErrorCode = (typeof SENDING_IDENTITY_ERROR_CODES)[number];

export class SendingIdentityError extends Error {
  readonly code: SendingIdentityErrorCode;

  constructor(code: SendingIdentityErrorCode, message: string) {
    super(`${code} — ${message}`);
    this.name = 'SendingIdentityError';
    this.code = code;
  }
}

export function parseFromEmail(from: string): string {
  const raw = from.trim();
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}
