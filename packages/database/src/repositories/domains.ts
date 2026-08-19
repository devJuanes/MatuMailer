import type { Domain, DomainDnsRecord, DomainWithRecords } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertMany, insertOne, updateMany, updateOne } from '../helpers';

export async function listDomainsByProject(projectId: string): Promise<Domain[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('mailer_domains')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Domain[];
}

export async function findDomainById(id: string): Promise<Domain | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('mailer_domains').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Domain;
}

export async function findDomainByDomain(
  projectId: string,
  domain: string,
): Promise<Domain | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('mailer_domains')
    .select('*')
    .eq('project_id', projectId)
    .eq('domain', domain.toLowerCase().trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as Domain;
}

export async function findVerifiedDomainForEmail(
  projectId: string,
  email: string,
): Promise<Domain | null> {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return null;

  const db = getMatuDb();
  const { data, error } = await db
    .from('mailer_domains')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'verified');
  if (error || !data) return null;

  const normalizedTarget = domain.toLowerCase();
  const match = (data as Domain[]).find((d) => {
    const candidate = d.domain.toLowerCase();
    return candidate === normalizedTarget || normalizedTarget.endsWith(`.${candidate}`);
  });
  return match ?? null;
}

export async function listRecordsByDomain(domainId: string): Promise<DomainDnsRecord[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('mailer_domain_dns_records')
    .select('*')
    .eq('domain_id', domainId)
    .order('type', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DomainDnsRecord[];
}

export async function findDomainWithRecords(id: string): Promise<DomainWithRecords | null> {
  const domain = await findDomainById(id);
  if (!domain) return null;
  const records = await listRecordsByDomain(id);
  return { ...domain, records };
}

export async function createDomain(input: {
  project_id: string;
  domain: string;
  region: Domain['region'];
  dkim_selector: string;
  dkim_public_key: string;
  dkim_private_key_encrypted: string;
  return_path_subdomain: string;
  records: Array<{
    type: 'TXT' | 'CNAME' | 'MX';
    host: string;
    value: string;
    priority?: number | null;
  }>;
}): Promise<DomainWithRecords> {
  const domain = await insertOne<Domain>('mailer_domains', {
    project_id: input.project_id,
    domain: input.domain.toLowerCase().trim(),
    region: input.region,
    status: 'pending',
    dkim_selector: input.dkim_selector,
    dkim_public_key: input.dkim_public_key,
    dkim_private_key_encrypted: input.dkim_private_key_encrypted,
    return_path_subdomain: input.return_path_subdomain,
    last_check_at: null,
    last_verified_at: null,
  });

  const records = await insertMany<DomainDnsRecord>(
    'mailer_domain_dns_records',
    input.records.map((r) => ({
      domain_id: domain.id,
      type: r.type,
      host: r.host,
      value: r.value,
      priority: r.priority ?? null,
      status: 'pending',
      last_check_at: null,
      last_value: null,
    })),
  );

  return { ...domain, records };
}

export async function updateDomainStatus(
  id: string,
  status: Domain['status'],
  verified = false,
): Promise<void> {
  const now = new Date().toISOString();
  await updateMany('mailer_domains', [{ column: 'id', value: id }], {
    status,
    last_check_at: now,
    last_verified_at: verified ? now : undefined,
  } as Record<string, unknown>);
}

export async function updateRecordStatus(
  id: string,
  status: 'pending' | 'verified' | 'failed',
  lastValue: string | null,
): Promise<void> {
  await updateOne<DomainDnsRecord>('mailer_domain_dns_records', [{ column: 'id', value: id }], {
    status,
    last_check_at: new Date().toISOString(),
    last_value: lastValue,
  });
}

export async function deleteDomain(id: string): Promise<void> {
  const db = getMatuDb();
  await db.from('mailer_domains').eq('id', id).delete();
}

export async function setProjectDefaultDomain(
  projectId: string,
  domainId: string | null,
): Promise<void> {
  await updateMany('mailer_projects', [{ column: 'id', value: projectId }], {
    default_domain_id: domainId,
  } as Record<string, unknown>);
}

export async function getProjectDefaultDomain(projectId: string): Promise<Domain | null> {
  const db = getMatuDb();
  const { data: project, error: projectError } = await db
    .from('mailer_projects')
    .select('default_domain_id')
    .eq('id', projectId)
    .maybeSingle();
  if (projectError || !project) return null;
  const defaultDomainId = (project as { default_domain_id?: string | null }).default_domain_id;
  if (!defaultDomainId) return null;
  return findDomainById(defaultDomainId);
}
