export const API_TOKEN_PREFIX = 'mm_live_';
export const API_TOKEN_PREFIX_TEST = 'mm_test_';

export const TEMPLATE_SLUGS = ['welcome', 'password-recovery', 'notification'] as const;

export const SMTP_PROVIDERS = ['gmail', 'outlook', 'zoho', 'custom'] as const;

export const EMAIL_STATUS = ['queued', 'sent', 'failed', 'bounced'] as const;

export const SCHEDULED_EMAIL_STATUS = [
  'pending',
  'processing',
  'sent',
  'failed',
  'cancelled',
] as const;
