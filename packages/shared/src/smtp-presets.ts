import type { SmtpProvider } from './types';

export interface SmtpPreset {
  provider: SmtpProvider;
  host: string;
  port: number;
  secure: boolean;
  domains: string[];
}

export const SMTP_PRESETS: SmtpPreset[] = [
  {
    provider: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    domains: ['gmail.com', 'googlemail.com'],
  },
  {
    provider: 'outlook',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'office365.com'],
  },
  {
    provider: 'zoho',
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    domains: ['zoho.com', 'zohomail.com'],
  },
];

export function detectSmtpProvider(email: string): SmtpPreset | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  return SMTP_PRESETS.find((p) => p.domains.some((d) => domain === d || domain.endsWith(`.${d}`))) ?? null;
}

export function detectSmtpFromHost(host: string): SmtpPreset | null {
  const h = host.toLowerCase();
  return SMTP_PRESETS.find((p) => h.includes(p.provider) || h === p.host) ?? null;
}
