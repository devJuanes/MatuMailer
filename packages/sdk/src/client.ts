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
  SendingIdentity,
  UpdateAliasPayload,
} from './types.js';
import { MatuMailerError, parseApiError } from './errors.js';
import { loadEnvToken } from './env-token.js';

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

  readonly emails: {
    send: (payload: SendEmailPayload) => Promise<{ id: string; status: string; from?: string }>;
    sendBulk: (payload: BulkSendPayload) => Promise<BulkSendResult>;
    sendBulkFromJson: (payload: BulkSendFromJsonPayload) => Promise<BulkSendResult>;
    sendToGroup: (payload: GroupSendPayload) => Promise<GroupSendResult>;
  };

  readonly domains: {
    list: (projectId?: string) => Promise<{ domains: DomainRecord[] }>;
    create: (projectId: string, payload: CreateDomainPayload) => Promise<{ domain: DomainWithRecords }>;
    get: (domainId: string) => Promise<{ domain: DomainWithRecords }>;
    verify: (domainId: string) => Promise<DomainVerifyResult>;
    delete: (domainId: string) => Promise<{ deleted: boolean }>;
    setDefault: (domainId: string) => Promise<{ domain: string; isDefault: boolean }>;
  };

  readonly aliases: {
    list: (
      projectId?: string,
      opts?: { domainId?: string; activeOnly?: boolean },
    ) => Promise<{ aliases: Alias[] }>;
    create: (projectId: string, payload: CreateAliasPayload) => Promise<{ alias: Alias }>;
    update: (aliasId: string, payload: UpdateAliasPayload) => Promise<{ alias: Alias }>;
    delete: (aliasId: string) => Promise<{ deleted: boolean }>;
  };

  readonly sendingIdentities: {
    list: (projectId?: string) => Promise<{
      identities: SendingIdentity[];
      defaultSendingIdentityId: string | null;
    }>;
    get: (id: string, projectId?: string) => Promise<{ identity: SendingIdentity }>;
  };

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

    this.emails = {
      send: (payload) => this.send(payload),
      sendBulk: (payload) => this.sendBulk(payload),
      sendBulkFromJson: (payload) => this.sendBulkFromJson(payload),
      sendToGroup: (payload) => this.sendToGroup(payload),
    };
    this.domains = {
      list: (projectId) => this.listDomains(projectId),
      create: (projectId, payload) => this.createDomain(projectId, payload),
      get: (domainId) => this.getDomain(domainId),
      verify: (domainId) => this.verifyDomain(domainId),
      delete: (domainId) => this.deleteDomain(domainId),
      setDefault: (domainId) => this.setDefaultDomain(domainId),
    };
    this.aliases = {
      list: (projectId, opts) => this.listAliases(projectId, opts),
      create: (projectId, payload) => this.createAlias(projectId, payload),
      update: (aliasId, payload) => this.updateAlias(aliasId, payload),
      delete: (aliasId) => this.deleteAlias(aliasId),
    };
    this.sendingIdentities = {
      list: (projectId) => this.listSendingIdentities(projectId),
      get: (id, projectId) => this.getSendingIdentity(id, projectId),
    };
  }

  async send(payload: SendEmailPayload): Promise<{ id: string; status: string; from?: string }> {
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

  async sendBulk(payload: BulkSendPayload): Promise<BulkSendResult> {
    return this.request('/api/emails/send/bulk', { method: 'POST', body: payload });
  }

  async sendBulkFromJson(payload: BulkSendFromJsonPayload): Promise<BulkSendResult> {
    return this.request('/api/emails/send/bulk-from-json', { method: 'POST', body: payload });
  }

  async sendToGroup(payload: GroupSendPayload): Promise<GroupSendResult> {
    return this.request('/api/emails/send/group', { method: 'POST', body: payload });
  }

  async listDomains(projectId?: string): Promise<{ domains: DomainRecord[] }> {
    return this.request(`/api/domains${buildQuery({ projectId })}`, { method: 'GET' });
  }

  async createDomain(
    projectId: string,
    payload: CreateDomainPayload,
  ): Promise<{ domain: DomainWithRecords }> {
    return this.request(`/api/domains${buildQuery({ projectId })}`, {
      method: 'POST',
      body: payload,
    });
  }

  async getDomain(domainId: string): Promise<{ domain: DomainWithRecords }> {
    return this.request(`/api/domains/${domainId}`, { method: 'GET' });
  }

  async verifyDomain(domainId: string): Promise<DomainVerifyResult> {
    return this.request(`/api/domains/${domainId}/verify`, { method: 'POST' });
  }

  async deleteDomain(domainId: string): Promise<{ deleted: boolean }> {
    return this.request(`/api/domains/${domainId}`, { method: 'DELETE' });
  }

  async setDefaultDomain(domainId: string): Promise<{ domain: string; isDefault: boolean }> {
    return this.request(`/api/domains/${domainId}/default`, { method: 'POST' });
  }

  async listAliases(
    projectId?: string,
    opts: { domainId?: string; activeOnly?: boolean } = {},
  ): Promise<{ aliases: Alias[] }> {
    const qs = buildQuery({
      projectId,
      domainId: opts.domainId,
      activeOnly: opts.activeOnly,
    });
    return this.request(`/api/aliases${qs}`, { method: 'GET' });
  }

  async createAlias(projectId: string, payload: CreateAliasPayload): Promise<{ alias: Alias }> {
    return this.request(`/api/aliases?projectId=${projectId}`, {
      method: 'POST',
      body: payload,
    });
  }

  async updateAlias(aliasId: string, payload: UpdateAliasPayload): Promise<{ alias: Alias }> {
    return this.request(`/api/aliases/${aliasId}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  async deleteAlias(aliasId: string): Promise<{ deleted: boolean }> {
    return this.request(`/api/aliases/${aliasId}`, { method: 'DELETE' });
  }

  async listSendingIdentities(projectId?: string): Promise<{
    identities: SendingIdentity[];
    defaultSendingIdentityId: string | null;
  }> {
    return this.request(`/api/sending-identities${buildQuery({ projectId })}`, { method: 'GET' });
  }

  async getSendingIdentity(
    id: string,
    projectId?: string,
  ): Promise<{ identity: SendingIdentity }> {
    return this.request(`/api/sending-identities/${id}${buildQuery({ projectId })}`, {
      method: 'GET',
    });
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
