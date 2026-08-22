import { api } from '@/lib/api';

/** Espejo del tipo `Domain` del backend para el front. */
export type DomainStatus = 'pending' | 'verifying' | 'verified' | 'failed' | 'disabled';
export type DomainRegion = 'us-east-1' | 'sa-east-1' | 'eu-west-1';

export type DomainRecord = {
  id: string;
  domain: string;
  region: DomainRegion;
  status: DomainStatus;
  dkim_selector: string;
  return_path_subdomain: string;
  last_check_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DomainDnsRecord = {
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
};

export type DomainWithRecords = DomainRecord & { records: DomainDnsRecord[] };

export type DomainVerifyResult = {
  domain: DomainWithRecords;
  verified: boolean;
  fullyVerified?: boolean;
  capabilities?: {
    sending: 'ready' | 'pending' | 'warning' | 'blocked';
    receiving: 'ready' | 'pending' | 'warning' | 'blocked';
    dmarc: 'ready' | 'pending' | 'warning' | 'blocked';
  };
  warnings?: string[];
  missing: Array<{
    type: 'TXT' | 'CNAME' | 'MX';
    host: string;
    purpose?: string;
    reason: string;
    detected?: string[];
  }>;
  message?: string;
  autoRefreshed?: boolean;
};

export async function listDomains(projectId: string): Promise<DomainRecord[]> {
  const res = await api<{ domains: DomainRecord[] }>(`/api/domains?projectId=${projectId}`);
  return res.domains;
}

export async function createDomain(
  projectId: string,
  payload: { domain: string; region: DomainRegion },
): Promise<DomainWithRecords> {
  const res = await api<{ domain: DomainWithRecords }>(`/api/domains?projectId=${projectId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.domain;
}

export async function getDomain(domainId: string): Promise<DomainWithRecords> {
  const res = await api<{ domain: DomainWithRecords }>(`/api/domains/${domainId}`);
  return res.domain;
}

export async function verifyDomain(domainId: string): Promise<DomainVerifyResult> {
  return api<DomainVerifyResult>(`/api/domains/${domainId}/verify`, { method: 'POST' });
}

export type DomainDiagnostics = {
  domain: string;
  domainId: string;
  domainStatus: string;
  receivingReady: boolean;
  sendingReady: boolean;
  inbound: {
    likely550Cause: string | null;
    explanation: string;
  };
  mailboxes: Array<{
    email: string;
    ready: boolean;
    inPostfixMap: boolean | null;
    reason?: string;
  }>;
  mx: {
    records: Array<{ priority: number; host: string }>;
    otherProviders: string[];
  };
};

export async function getDomainDiagnostics(domainId: string): Promise<{ diagnostics: DomainDiagnostics }> {
  return api(`/api/domains/${domainId}/diagnostics`);
}

export async function refreshDomainDns(domainId: string): Promise<{
  domain: DomainWithRecords;
  message?: string;
}> {
  return api(`/api/domains/${domainId}/refresh-dns`, { method: 'POST' });
}

export async function deleteDomain(domainId: string): Promise<void> {
  await api<{ deleted: boolean }>(`/api/domains/${domainId}`, { method: 'DELETE' });
}

export async function setDefaultDomain(domainId: string): Promise<void> {
  await api<{ isDefault: boolean }>(`/api/domains/${domainId}/default`, { method: 'POST' });
}
