import { detectSmtpProvider } from '@matumailer/shared';
import type { SmtpPreset } from './types.js';

export function detectSmtp(email: string): SmtpPreset | null {
  return detectSmtpProvider(email);
}

export function loadEnvToken(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.MATUMAILER_TOKEN ??
      process.env.MATU_MAILER_TOKEN ??
      process.env.MATUMAILER_API_KEY
    );
  }
  return undefined;
}
