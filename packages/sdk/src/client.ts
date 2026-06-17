import type {
  BulkSendFromJsonPayload,
  BulkSendPayload,
  BulkSendResult,
  MatuMailerConfig,
  SendEmailPayload,
} from './types.js';
import { MatuMailerError, parseApiError } from './errors.js';
import { detectSmtp, loadEnvToken } from './smtp-detect.js';

const DEFAULT_BASE_URL = 'https://api.matucatalogo.com';

export class MatuMailer {
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(config?: MatuMailerConfig) {
    const token = config?.token ?? loadEnvToken();
    if (!token) {
      throw new MatuMailerError(
        'API token is required. Pass { token } or set MATUMAILER_TOKEN env variable.',
        'MISSING_TOKEN',
      );
    }
    this.token = token;
    this.baseUrl = (config?.baseUrl ?? process.env.MATUMAILER_API_URL ?? DEFAULT_BASE_URL).replace(
      /\/$/,
      '',
    );
  }

  async send(payload: SendEmailPayload): Promise<{ id: string; status: string }> {
    return this.request('/api/emails/send', payload);
  }

  async sendTemplate(
    to: string | string[],
    template: string,
    data?: Record<string, unknown>,
    subject?: string,
  ): Promise<{ id: string; status: string }> {
    return this.send({ to, template, data, subject });
  }

  /** Envío masivo: un correo individual por destinatario (privacidad total). */
  async sendBulk(payload: BulkSendPayload): Promise<BulkSendResult> {
    return this.request('/api/emails/send/bulk', payload);
  }

  /** Envío masivo desde JSON de usuarios (objeto o array). */
  async sendBulkFromJson(payload: BulkSendFromJsonPayload): Promise<BulkSendResult> {
    return this.request('/api/emails/send/bulk-from-json', payload);
  }

  detectSmtp(email: string) {
    return detectSmtp(email);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw parseApiError(data, res.status);
    }

    return data as T;
  }
}
