/** Tipos públicos del SDK (no dependen de publicar @matumailer/shared en npm). */
export interface SendEmailPayload {
  to: string | string[];
  subject?: string;
  template?: string;
  html?: string;
  text?: string;
  data?: Record<string, unknown>;
  scheduledAt?: string;
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
  results: Array<{ email: string; id?: string; status: string; error?: string }>;
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
