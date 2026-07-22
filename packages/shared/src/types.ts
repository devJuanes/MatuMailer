import type {
  EMAIL_STATUS,
  SCHEDULED_EMAIL_STATUS,
  SMTP_PROVIDERS,
  TEMPLATE_SLUGS,
} from './constants';

export type SmtpProvider = (typeof SMTP_PROVIDERS)[number];
export type TemplateSlug = (typeof TEMPLATE_SLUGS)[number];
export type EmailStatus = (typeof EMAIL_STATUS)[number];
export type ScheduledEmailStatus = (typeof SCHEDULED_EMAIL_STATUS)[number];

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
  smtpConfigured: boolean;
  welcomeTemplate: boolean;
  hasApiToken: boolean;
  testEmailSent: boolean;
  completedCount: number;
  totalSteps: number;
}

export interface SmtpConfig {
  id: string;
  project_id: string;
  provider: SmtpProvider;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password_encrypted: string;
  from_email: string;
  from_name: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
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
  type: 'open' | 'click';
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
