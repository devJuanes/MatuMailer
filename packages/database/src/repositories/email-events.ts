import type { EmailEvent } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne } from '../helpers';

export async function create(input: {
  email_log_id: string;
  project_id: string;
  type: 'open' | 'click';
  url?: string | null;
  user_agent?: string | null;
}): Promise<EmailEvent> {
  return insertOne<EmailEvent>('email_events', {
    email_log_id: input.email_log_id,
    project_id: input.project_id,
    type: input.type,
    url: input.url ?? null,
    user_agent: input.user_agent ?? null,
  });
}

export async function listByLog(emailLogId: string): Promise<EmailEvent[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('email_events')
    .select('*')
    .eq('email_log_id', emailLogId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailEvent[];
}

export async function countByProject(
  projectId: string,
): Promise<{ opens: number; clicks: number }> {
  const db = getMatuDb();
  const { data, error } = await db.from('email_events').select('type').eq('project_id', projectId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { type: string }[];
  return {
    opens: rows.filter((r) => r.type === 'open').length,
    clicks: rows.filter((r) => r.type === 'click').length,
  };
}

export async function findLogByTrackingToken(token: string) {
  const db = getMatuDb();
  const { data, error } = await db
    .from('email_logs')
    .select('*')
    .eq('tracking_token', token)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; project_id: string; tracking_token: string };
}
