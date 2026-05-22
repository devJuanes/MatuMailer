import type { EmailLog, EmailStatus } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateMany } from '../helpers';

export async function findEmailLogsByProjectId(
  projectId: string,
  options?: { limit?: number; offset?: number; status?: EmailStatus },
): Promise<EmailLog[]> {
  const db = getMatuDb();
  let query = db
    .from('email_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailLog[];
}

export async function createEmailLog(
  input: Omit<EmailLog, 'id' | 'created_at'>,
): Promise<EmailLog> {
  return insertOne<EmailLog>('email_logs', input);
}

export async function updateEmailLogStatus(
  id: string,
  status: EmailStatus,
  extra?: { error_message?: string; sent_at?: string },
): Promise<void> {
  await updateMany('email_logs', [{ column: 'id', value: id }], { status, ...extra });
}

export async function getEmailStats(projectId: string): Promise<{
  total: number;
  sent: number;
  failed: number;
  queued: number;
}> {
  const db = getMatuDb();
  const { data, error } = await db.rpc(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'queued')::int AS queued
    FROM email_logs
    WHERE project_id = '${projectId}'
  `);
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as {
    total: number;
    sent: number;
    failed: number;
    queued: number;
  };
  return row ?? { total: 0, sent: 0, failed: 0, queued: 0 };
}
