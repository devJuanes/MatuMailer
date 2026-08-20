import { getMatuDb } from '@/lib/matudb';

export interface EmailLog {
  id: string;
  to_email: string;
  subject: string;
  template_slug: string | null;
  status: string;
  error_message?: string | null;
  user_message?: string | null;
  created_at: string;
  from_email?: string | null;
  domain_id?: string | null;
  alias_id?: string | null;
  provider?: string | null;
  message_id?: string | null;
}

export async function listEmailLogs(
  projectId: string,
  options?: { limit?: number },
): Promise<EmailLog[]> {
  const db = getMatuDb();
  let query = db
    .from('email_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailLog[];
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
