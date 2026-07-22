import type { Campaign } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateOne } from '../helpers';

export async function create(input: {
  project_id: string;
  name: string;
  template_slug?: string | null;
  group_id?: string | null;
  status?: string;
  scheduled_at?: string | null;
  total_count?: number;
}): Promise<Campaign> {
  return insertOne<Campaign>('campaigns', {
    project_id: input.project_id,
    name: input.name,
    template_slug: input.template_slug ?? null,
    group_id: input.group_id ?? null,
    status: input.status ?? 'pending',
    scheduled_at: input.scheduled_at ?? null,
    total_count: input.total_count ?? 0,
    sent_count: 0,
    failed_count: 0,
  });
}

export async function findById(id: string): Promise<Campaign | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('campaigns').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Campaign;
}

export async function listByProject(projectId: string, limit = 50): Promise<Campaign[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('campaigns')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Campaign[];
}

export async function incrementCounts(
  id: string,
  delta: { sent?: number; failed?: number },
): Promise<void> {
  const campaign = await findById(id);
  if (!campaign) return;
  const sent = campaign.sent_count + (delta.sent ?? 0);
  const failed = campaign.failed_count + (delta.failed ?? 0);
  const status =
    sent + failed >= campaign.total_count && campaign.total_count > 0
      ? 'completed'
      : campaign.status === 'pending'
        ? 'processing'
        : campaign.status;
  await updateOne<Campaign>('campaigns', [{ column: 'id', value: id }], {
    sent_count: sent,
    failed_count: failed,
    status,
  });
}

export async function updateStatus(id: string, status: string): Promise<void> {
  await updateOne<Campaign>('campaigns', [{ column: 'id', value: id }], { status });
}

export async function cancelPending(id: string): Promise<Campaign | null> {
  const campaign = await findById(id);
  if (!campaign || !['pending', 'processing'].includes(campaign.status)) return null;
  return updateOne<Campaign>('campaigns', [{ column: 'id', value: id }], { status: 'cancelled' });
}
