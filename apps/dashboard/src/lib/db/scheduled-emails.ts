import { getMatuDb } from '@/lib/matudb';

export interface ScheduledEmail {
  id: string;
  to_email: string;
  subject: string;
  scheduled_at: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export async function listScheduledEmails(projectId: string): Promise<ScheduledEmail[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('scheduled_emails')
    .select('*')
    .eq('project_id', projectId)
    .order('scheduled_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledEmail[];
}

export async function cancelScheduledEmail(id: string): Promise<void> {
  const db = getMatuDb();
  const { data: existing, error: findErr } = await db
    .from('scheduled_emails')
    .select('status')
    .eq('id', id)
    .single();
  if (findErr || !existing) throw new Error('Envío programado no encontrado');
  if (existing.status !== 'pending') throw new Error('Solo se pueden cancelar envíos pendientes');

  const { error } = await db.from('scheduled_emails').eq('id', id).update({ status: 'cancelled' });
  if (error) throw new Error(error.message);
}
