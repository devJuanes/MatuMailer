import type { InboundMessage } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateOne } from '../helpers';

export type InboundFolder = 'inbox' | 'favorite' | 'sent' | 'archive' | 'trash' | 'spam';

export async function create(input: {
  project_id: string;
  domain_id?: string | null;
  alias_id?: string | null;
  message_id?: string | null;
  from_email: string;
  from_name?: string | null;
  to_email: string;
  subject?: string;
  preview?: string | null;
  text_body?: string | null;
  html_body?: string | null;
  folder?: InboundFolder;
  category?: string;
  unread?: boolean;
  has_attachment?: boolean;
  raw_headers?: Record<string, unknown> | null;
}): Promise<InboundMessage> {
  return insertOne<InboundMessage>('inbound_messages', {
    project_id: input.project_id,
    domain_id: input.domain_id ?? null,
    alias_id: input.alias_id ?? null,
    message_id: input.message_id ?? null,
    from_email: input.from_email.toLowerCase().trim(),
    from_name: input.from_name ?? null,
    to_email: input.to_email.toLowerCase().trim(),
    subject: input.subject ?? '',
    preview: input.preview ?? null,
    text_body: input.text_body ?? null,
    html_body: input.html_body ?? null,
    folder: input.folder ?? 'inbox',
    category: input.category ?? 'primary',
    starred: false,
    pinned: false,
    unread: input.unread ?? true,
    has_attachment: input.has_attachment ?? false,
    raw_headers: input.raw_headers ?? null,
  } as Partial<InboundMessage>);
}

export async function listByProject(
  projectId: string,
  opts: { folder?: string; toEmail?: string; limit?: number } = {},
): Promise<InboundMessage[]> {
  const db = getMatuDb();
  let query = db
    .from('inbound_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('received_at', { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.folder && opts.folder !== 'favorite') {
    query = query.eq('folder', opts.folder);
  }
  if (opts.folder === 'favorite') {
    query = query.eq('starred', true);
  }
  if (opts.toEmail) {
    query = query.eq('to_email', opts.toEmail.toLowerCase().trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as InboundMessage[];
}

export async function findById(id: string): Promise<InboundMessage | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('inbound_messages').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as InboundMessage;
}

export async function updateFlags(
  id: string,
  updates: Partial<{
    folder: string;
    starred: boolean;
    pinned: boolean;
    unread: boolean;
    category: string;
  }>,
): Promise<InboundMessage> {
  return updateOne<InboundMessage>('inbound_messages', [{ column: 'id', value: id }], updates);
}

/** Elimina mensajes demo (@example.com) de un proyecto. */
export async function deleteDemoMessages(projectId: string): Promise<number> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('inbound_messages')
    .select('id,from_email,to_email')
    .eq('project_id', projectId)
    .limit(500);
  if (error) throw new Error(error.message);

  const demoIds = (data ?? [])
    .filter((row: { from_email?: string; to_email?: string }) => {
      const from = String(row.from_email ?? '').toLowerCase();
      const to = String(row.to_email ?? '').toLowerCase();
      return from.endsWith('@example.com') || to.endsWith('@example.com');
    })
    .map((row: { id: string }) => row.id);

  if (demoIds.length === 0) return 0;

  const { error: delErr } = await db.from('inbound_messages').in('id', demoIds).delete();
  if (delErr) throw new Error(delErr.message);
  return demoIds.length;
}
