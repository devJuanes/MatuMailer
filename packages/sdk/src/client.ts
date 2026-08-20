import type {
  Alias,
  BulkSendFromJsonPayload,
  BulkSendPayload,
  BulkSendResult,
  CreateAliasPayload,
  CreateDomainPayload,
  DomainRecord,
  DomainVerifyResult,
  DomainWithRecords,
  GroupSendPayload,
  GroupSendResult,
  MatuMailerConfig,
  SendEmailPayload,
  UpdateAliasPayload,
} from './types.js';
import { MatuMailerError, parseApiError } from './errors.js';
import { detectSmtp, loadEnvToken } from './smtp-detect.js';

const DEFAULT_BASE_URL = 'https://api.matucatalogo.com';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildQuery(params: Record<string, string | number | boolean | undefined> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

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
    return this.request('/api/emails/send', { method: 'POST', body: payload });
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
    return this.request('/api/emails/send/bulk', { method: 'POST', body: payload });
  }

  /** Envío masivo desde JSON de usuarios (objeto o array). */
  async sendBulkFromJson(payload: BulkSendFromJsonPayload): Promise<BulkSendResult> {
    return this.request('/api/emails/send/bulk-from-json', { method: 'POST', body: payload });
  }

  /** Envío a un grupo de contactos (inmediato o programado). */
  async sendToGroup(payload: GroupSendPayload): Promise<GroupSendResult> {
    return this.request('/api/emails/send/group', { method: 'POST', body: payload });
  }

  /** Lista los dominios configurados para el proyecto. */
  async listDomains(projectId: string): Promise<{ domains: DomainRecord[] }> {
    return this.request(`/api/domains${buildQuery({ projectId })}`, { method: 'GET' });
  }

  /** Añade un nuevo dominio y devuelve los registros DNS a publicar. */
  async createDomain(
    projectId: string,
    payload: CreateDomainPayload,
  ): Promise<{ domain: DomainWithRecords }> {
    return this.request(`/api/domains${buildQuery({ projectId })}`, {
      method: 'POST',
      body: payload,
    });
  }

  /** Obtiene un dominio con sus registros DNS. */
  async getDomain(domainId: string): Promise<{ domain: DomainWithRecords }> {
    return this.request(`/api/domains/${domainId}`, { method: 'GET' });
  }

  /** Re-verifica los registros DNS de un dominio. */
  async verifyDomain(domainId: string): Promise<DomainVerifyResult> {
    return this.request(`/api/domains/${domainId}/verify`, { method: 'POST' });
  }

  /** Elimina un dominio del proyecto. */
  async deleteDomain(domainId: string): Promise<{ deleted: boolean }> {
    return this.request(`/api/domains/${domainId}`, { method: 'DELETE' });
  }

  /** Marca un dominio verificado como remitente por defecto del proyecto. */
  async setDefaultDomain(domainId: string): Promise<{ domain: string; isDefault: boolean }> {
    return this.request(`/api/domains/${domainId}/default`, { method: 'POST' });
  }

  // ─── Aliases ──────────────────────────────────────────────────────────────

  /** Lista aliases de un proyecto. `domainId` opcional para filtrar por dominio. */
  async listAliases(
    projectId: string,
    opts: { domainId?: string; activeOnly?: boolean } = {},
  ): Promise<{ aliases: Alias[] }> {
    const qs = buildQuery({
      projectId,
      domainId: opts.domainId,
      activeOnly: opts.activeOnly,
    });
    return this.request(`/api/aliases${qs}`, { method: 'GET' });
  }

  /** Crea un alias. El `localPart` es la parte antes del `@` (ej: "support"). */
  async createAlias(projectId: string, payload: CreateAliasPayload): Promise<{ alias: Alias }> {
    return this.request(`/api/aliases?projectId=${projectId}`, {
      method: 'POST',
      body: payload,
    });
  }

  /** Edita un alias. Solo los campos provistos se actualizan. */
  async updateAlias(aliasId: string, payload: UpdateAliasPayload): Promise<{ alias: Alias }> {
    return this.request(`/api/aliases/${aliasId}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  /** Elimina un alias. */
  async deleteAlias(aliasId: string): Promise<{ deleted: boolean }> {
    return this.request(`/api/aliases/${aliasId}`, { method: 'DELETE' });
  }

  detectSmtp(email: string) {
    return detectSmtp(email);
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'POST';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    const res = await fetch(`${this.baseUrl}${path}`, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw parseApiError(data, res.status);
    }
    return data as T;
  }
}
