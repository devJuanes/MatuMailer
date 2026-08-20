/** Tipos públicos del SDK (no dependen de publicar @matumailer/shared en npm). */
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
  /**
   * Forzar el dominio verificado cuando el proyecto tiene varios. Si se omite,
   * el server usa el `default_domain_id` del proyecto y, si no, el primer
   * dominio verificado con un alias activo.
   */
  domainId?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface BulkRecipient {
  email: string;
  data?: Record<string, unknown>;
}

export interface BulkSendPayload {
  template: string;
  subject?: string;
  recipients: BulkRecipient[];
  delayMs?: number;
  scheduledAt?: string;
  campaignName?: string;
  from?: string;
  fromName?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface BulkSendFromJsonPayload {
  template: string;
  subject?: string;
  emailField?: string;
  fieldMapping?: Record<string, string>;
  excludeFields?: string[];
  delayMs?: number;
  users: Record<string, Record<string, unknown>> | Array<Record<string, unknown>>;
}

export interface BulkSendResult {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
  emailField?: string;
  skipped?: number;
  scheduled?: boolean;
  campaignId?: string;
  results: Array<{ email: string; id?: string; status: string; error?: string }>;
}

export interface GroupSendPayload {
  groupId: string;
  template?: string;
  subject?: string;
  html?: string;
  data?: Record<string, unknown>;
  scheduledAt?: string;
  campaignName?: string;
}

export interface GroupSendResult {
  success: boolean;
  scheduled?: boolean;
  campaignId?: string;
  total: number;
  sent?: number;
  failed?: number;
  results?: Array<{ email: string; id?: string; status: string; error?: string }>;
}

export interface MatuMailerConfig {
  token: string;
  baseUrl?: string;
}

export interface SmtpPreset {
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  domains: string[];
}

export interface DomainRecord {
  id: string;
  domain: string;
  status: 'pending' | 'verifying' | 'verified' | 'failed' | 'disabled';
  region: string;
  dkim_selector: string;
  return_path_subdomain: string;
  last_check_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainDnsRecord {
  id: string;
  domain_id: string;
  type: 'TXT' | 'CNAME' | 'MX';
  host: string;
  value: string;
  priority: number | null;
  status: 'pending' | 'verified' | 'failed';
  last_check_at: string | null;
  last_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainWithRecords extends DomainRecord {
  records: DomainDnsRecord[];
}

export interface CreateDomainPayload {
  domain: string;
  region?: 'us-east-1' | 'sa-east-1' | 'eu-west-1';
}

export interface DomainVerifyResult {
  domain: DomainWithRecords;
  verified: boolean;
  missing: Array<{ type: string; host: string; reason: string }>;
}

export interface Alias {
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
  domain: string;
}

export interface CreateAliasPayload {
  domainId: string;
  localPart: string;
  displayName?: string | null;
  replyTo?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdateAliasPayload {
  displayName?: string | null;
  replyTo?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}
