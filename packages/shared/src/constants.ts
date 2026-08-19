export const API_TOKEN_PREFIX = 'mm_live_';
export const API_TOKEN_PREFIX_TEST = 'mm_test_';

export const TEMPLATE_SLUGS = ['welcome', 'password-recovery', 'notification', 'campana'] as const;

export const SMTP_PROVIDERS = ['gmail', 'outlook', 'zoho', 'custom'] as const;

export const EMAIL_STATUS = ['queued', 'sent', 'failed', 'bounced'] as const;

export const SCHEDULED_EMAIL_STATUS = [
  'pending',
  'processing',
  'sent',
  'failed',
  'cancelled',
] as const;

export const DOMAIN_STATUSES = ['pending', 'verifying', 'verified', 'failed', 'disabled'] as const;

export const DNS_RECORD_TYPES = ['TXT', 'CNAME', 'MX'] as const;

export const DOMAIN_REGIONS = ['us-east-1', 'sa-east-1', 'eu-west-1'] as const;
