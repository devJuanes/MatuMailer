import type { Contact } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, insertMany, toJsonb, updateOne } from '../helpers';

export async function listByProject(projectId: string, limit = 200): Promise<Contact[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('contacts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
}

export async function findById(id: string): Promise<Contact | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('contacts').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Contact;
}

export async function findByEmail(projectId: string, email: string): Promise<Contact | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('contacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as Contact;
}

export async function create(input: {
  project_id: string;
  email: string;
  name?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<Contact> {
  return insertOne<Contact>('contacts', {
    project_id: input.project_id,
    email: input.email.toLowerCase().trim(),
    name: input.name ?? null,
    metadata: toJsonb(input.metadata ?? {}) as unknown as Record<string, unknown>,
    unsubscribed_at: null,
  });
}

export async function upsertMany(
  projectId: string,
  rows: Array<{ email: string; name?: string | null; metadata?: Record<string, unknown> }>,
): Promise<Contact[]> {
  const created: Contact[] = [];
  for (const row of rows) {
    const email = row.email.toLowerCase().trim();
    if (!email.includes('@')) continue;
    const existing = await findByEmail(projectId, email);
    if (existing) {
      const updated = await updateOne<Contact>('contacts', [{ column: 'id', value: existing.id }], {
        name: row.name ?? existing.name,
        metadata: toJsonb(row.metadata ?? existing.metadata) as unknown as Record<string, unknown>,
      });
      created.push(updated);
    } else {
      created.push(
        await create({
          project_id: projectId,
          email,
          name: row.name,
          metadata: row.metadata,
        }),
      );
    }
  }
  return created;
}

export async function remove(id: string): Promise<void> {
  const db = getMatuDb();
  const { error } = await db.from('contacts').eq('id', id).delete();
  if (error) throw new Error(error.message);
}

export async function listByGroup(groupId: string): Promise<Contact[]> {
  const db = getMatuDb();
  const { data: members, error } = await db
    .from('contact_group_members')
    .select('contact_id')
    .eq('group_id', groupId);
  if (error) throw new Error(error.message);
  const ids = (members ?? []).map((m: { contact_id: string }) => m.contact_id);
  if (!ids.length) return [];

  const contacts: Contact[] = [];
  for (const id of ids) {
    const c = await findById(id);
    if (c && !c.unsubscribed_at) contacts.push(c);
  }
  return contacts;
}
