import type {
  DOMAIN_REGIONS,
  DOMAIN_STATUSES,
  DNS_RECORD_TYPES,
  EMAIL_STATUS,
  SCHEDULED_EMAIL_STATUS,
  TEMPLATE_SLUGS,
} from './constants';

export type TemplateSlug = (typeof TEMPLATE_SLUGS)[number];
export type EmailStatus = (typeof EMAIL_STATUS)[number];
export type ScheduledEmailStatus = (typeof SCHEDULED_EMAIL_STATUS)[number];
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];
export type DomainRegion = (typeof DOMAIN_REGIONS)[number];
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];
export type DnsRecordStatus = 'pending' | 'verified' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  default_domain_id?: string | null;
  default_alias_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiToken {
  id: string;
  project_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  token_encrypted?: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ProjectSetupStatus {
  hasVerifiedDomain: boolean;
  welcomeTemplate: boolean;
  hasApiToken: boolean;
  testEmailSent: boolean;
  completedCount: number;
  totalSteps: number;
}

export interface TemplateBlock {
  id: string;
  type: 'heading' | 'text' | 'button' | 'divider' | 'spacer' | 'image';
  content?: string;
  href?: string;
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
  color?: string;
  bgColor?: string;
  buttonColor?: string;
  padding?: number;
  height?: number;
}

export interface Template {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  builder_data: TemplateBlock[] | null;
  variables: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  project_id: string;
  to_email: string;
  subject: string;
  template_slug: string | null;
  status: EmailStatus;
  error_message: string | null;
  user_message?: string | null;
  campaign_id?: string | null;
  group_id?: string | null;
  tracking_token?: string | null;
  from_email?: string | null;
  domain_id?: string | null;
  alias_id?: string | null;
  provider?: string | null;
  message_id?: string | null;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  project_id: string;
  email: string;
  name: string | null;
  metadata: Record<string, unknown>;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactGroup {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface ProjectBranding {
  project_id: string;
  company_name: string | null;
  logo_url: string | null;
  primary_color: string;
  header_html: string | null;
  footer_html: string | null;
  tracking_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  project_id: string;
  name: string;
  template_slug: string | null;
  group_id: string | null;
  alias_id?: string | null;
  status: string;
  scheduled_at: string | null;
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmailEvent {
  id: string;
  email_log_id: string;
  project_id: string;
  type: 'open' | 'click' | 'unsubscribe';
  url: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface SendEmailPayload {
  to: string | string[];
  subject?: string;
  template?: string;
  html?: string;
  text?: string;
  data?: Record<string, unknown>;
  scheduledAt?: string;
  from?: string;
  fromName?: string;
  domainId?: string;
  aliasId?: string;
  projectId?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface ScheduledEmail {
  id: string;
  project_id: string;
  to_email: string;
  subject: string;
  payload: SendEmailPayload;
  scheduled_at: string;
  status: ScheduledEmailStatus;
  email_log_id: string | null;
  campaign_id?: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatuMailerConfig {
  token: string;
  baseUrl?: string;
}

export interface Domain {
  id: string;
  project_id: string;
  domain: string;
  region: DomainRegion;
  status: DomainStatus;
  dkim_selector: string;
  dkim_public_key: string;
  dkim_private_key_encrypted: string;
  return_path_subdomain: string;
  last_check_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainDnsRecord {
  id: string;
  domain_id: string;
  type: DnsRecordType;
  host: string;
  value: string;
  priority: number | null;
  status: DnsRecordStatus;
  last_check_at: string | null;
  last_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainWithRecords extends Domain {
  records: DomainDnsRecord[];
}

export interface DomainVerificationResult {
  domain: Domain;
  records: DomainDnsRecord[];
  verified: boolean;
  missing: Array<{ type: DnsRecordType; host: string; reason: string }>;
}

/**
 * Alias de envío (info@dominio.com, support@dominio.com, etc.) vinculado a un
 * dominio verificado. Se usa como cabecera `From` en los envíos salientes y
 * queda firmado con la clave DKIM del dominio padre.
 */
export interface DomainAlias {
  id: string;
  domain_id: string;
  local_part: string;
  full_email: string;
  display_name: string | null;
  reply_to: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DomainAliasWithDomain extends DomainAlias {
  domain: string;
}
