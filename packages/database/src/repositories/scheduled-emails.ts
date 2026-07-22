import type { ScheduledEmail, ScheduledEmailStatus, SendEmailPayload } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, toJsonb, updateOne } from '../helpers';

export async function createScheduledEmail(input: {
  project_id: string;
  to_email: string;
  subject: string;
  payload: SendEmailPayload;
  scheduled_at: string;
  campaign_id?: string | null;
}): Promise<ScheduledEmail> {
  const row = {
    ...input,
    payload: toJsonb(input.payload) as unknown as SendEmailPayload,
    status: 'pending' as ScheduledEmailStatus,
    email_log_id: null,
    error_message: null,
    campaign_id: input.campaign_id ?? null,
  };
  return insertOne<ScheduledEmail>('scheduled_emails', row);
}

export async function findScheduledByProjectId(
  projectId: string,
  limit = 50,
): Promise<ScheduledEmail[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('scheduled_emails')
    .select('*')
    .eq('project_id', projectId)
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledEmail[];
}

export async function findScheduledById(id: string): Promise<ScheduledEmail | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('scheduled_emails').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as ScheduledEmail;
}

export async function findDuePending(limit = 25): Promise<ScheduledEmail[]> {
  const db = getMatuDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('scheduled_emails')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledEmail[];
}

export async function resetStaleProcessing(olderThanMinutes = 10): Promise<void> {
  const db = getMatuDb();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data, error } = await db
    .from('scheduled_emails')
    .select('id')
    .eq('status', 'processing')
    .lte('updated_at', cutoff);
  if (error || !data?.length) return;
  for (const row of data as { id: string }[]) {
    await updateOne<ScheduledEmail>('scheduled_emails', [{ column: 'id', value: row.id }], {
      status: 'pending',
    });
  }
}

export async function markProcessing(id: string): Promise<void> {
  await updateOne<ScheduledEmail>('scheduled_emails', [{ column: 'id', value: id }], {
    status: 'processing',
  });
}

export async function markSent(id: string, emailLogId: string): Promise<void> {
  await updateOne<ScheduledEmail>('scheduled_emails', [{ column: 'id', value: id }], {
    status: 'sent',
    email_log_id: emailLogId,
    error_message: null,
  });
}

export async function markFailed(id: string, message: string): Promise<void> {
  await updateOne<ScheduledEmail>('scheduled_emails', [{ column: 'id', value: id }], {
    status: 'failed',
    error_message: message,
  });
}

export async function cancelScheduled(id: string): Promise<ScheduledEmail | null> {
  const existing = await findScheduledById(id);
  if (!existing || existing.status !== 'pending') return null;
  return updateOne<ScheduledEmail>('scheduled_emails', [{ column: 'id', value: id }], {
    status: 'cancelled',
  });
}

export async function countPendingByProject(projectId: string): Promise<number> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('scheduled_emails')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function cancelByCampaign(campaignId: string): Promise<number> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('scheduled_emails')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  if (error || !data?.length) return 0;
  let n = 0;
  for (const row of data as { id: string }[]) {
    await cancelScheduled(row.id);
    n += 1;
  }
  return n;
}

export async function countByCampaign(campaignId: string): Promise<{
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
}> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('scheduled_emails')
    .select('status')
    .eq('campaign_id', campaignId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { status: string }[];
  return {
    pending: rows.filter((r) => r.status === 'pending' || r.status === 'processing').length,
    sent: rows.filter((r) => r.status === 'sent').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
  };
}
