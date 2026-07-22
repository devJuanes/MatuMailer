import type { ContactGroup } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateOne } from '../helpers';

export async function listByProject(projectId: string): Promise<ContactGroup[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('contact_groups')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const groups = (data ?? []) as ContactGroup[];
  const withCounts: ContactGroup[] = [];
  for (const g of groups) {
    const { data: members } = await db
      .from('contact_group_members')
      .select('contact_id')
      .eq('group_id', g.id);
    withCounts.push({ ...g, member_count: (members ?? []).length });
  }
  return withCounts;
}

export async function findById(id: string): Promise<ContactGroup | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('contact_groups').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as ContactGroup;
}

export async function create(input: {
  project_id: string;
  name: string;
  description?: string | null;
}): Promise<ContactGroup> {
  return insertOne<ContactGroup>('contact_groups', {
    project_id: input.project_id,
    name: input.name.trim(),
    description: input.description ?? null,
  });
}

export async function update(
  id: string,
  updates: { name?: string; description?: string | null },
): Promise<ContactGroup> {
  return updateOne<ContactGroup>('contact_groups', [{ column: 'id', value: id }], updates);
}

export async function remove(id: string): Promise<void> {
  const db = getMatuDb();
  const { error } = await db.from('contact_groups').eq('id', id).delete();
  if (error) throw new Error(error.message);
}

export async function addMember(groupId: string, contactId: string): Promise<void> {
  const db = getMatuDb();
  const { error } = await db.from('contact_group_members').insert({
    group_id: groupId,
    contact_id: contactId,
  });
  if (error && !/duplicate|unique|already/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function removeMember(groupId: string, contactId: string): Promise<void> {
  const db = getMatuDb();
  const { error } = await db
    .from('contact_group_members')
    .eq('group_id', groupId)
    .eq('contact_id', contactId)
    .delete();
  if (error) throw new Error(error.message);
}

export async function setMembers(groupId: string, contactIds: string[]): Promise<void> {
  const db = getMatuDb();
  await db.from('contact_group_members').eq('group_id', groupId).delete();
  if (!contactIds.length) return;
  const rows = contactIds.map((contact_id) => ({ group_id: groupId, contact_id }));
  const { error } = await db.from('contact_group_members').insert(rows);
  if (error) throw new Error(error.message);
}
