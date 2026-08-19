import { api } from '@/lib/api';

export type DomainStatus = 'pending' | 'verifying' | 'verified' | 'failed' | 'disabled';
export type DomainRegion = 'us-east-1' | 'sa-east-1' | 'eu-west-1';
export type DnsRecordType = 'TXT' | 'CNAME' | 'MX';
export type DnsRecordStatus = 'pending' | 'verified' | 'failed';

export interface DomainRecord {
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

export interface DomainWithRecords extends DomainRecord {
  records: DomainDnsRecord[];
}

export interface DomainVerifyResult {
  domain: DomainWithRecords;
  verified: boolean;
  missing: Array<{ type: DnsRecordType; host: string; reason: string }>;
}

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

export async function deleteDomain(domainId: string): Promise<void> {
  await api<{ deleted: boolean }>(`/api/domains/${domainId}`, { method: 'DELETE' });
}

export async function setDefaultDomain(domainId: string): Promise<void> {
  await api<{ isDefault: boolean }>(`/api/domains/${domainId}/default`, { method: 'POST' });
}
