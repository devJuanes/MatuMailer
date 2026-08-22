import { api } from '@/lib/api';
import type { InboxEmail, MailAccount, MailCategory, MailFolder } from '@/lib/mail/types';

export interface ApiInboundMessage {
  id: string;
  project_id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  preview: string | null;
  text_body: string | null;
  html_body: string | null;
  folder: string;
  category: string;
  starred: boolean;
  pinned: boolean;
  unread: boolean;
  has_attachment: boolean;
  received_at: string;
  message_id?: string | null;
  raw_headers?: Record<string, string> | null;
}

function avatarFor(email: string) {
  const seed = encodeURIComponent(email.split('@')[0] || 'user');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

function sectionFor(ts: number): InboxEmail['section'] {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (ts >= startToday.getTime()) return 'today';
  if (ts >= startYesterday.getTime()) return 'yesterday';
  return 'earlier';
}

export function mapInboundToEmail(m: ApiInboundMessage): InboxEmail {
  const ts = new Date(m.received_at).getTime();
  const body = m.html_body || m.text_body || m.preview || '';
  const hdr = (m.raw_headers ?? {}) as Record<string, string>;
  const refRaw = hdr.references ?? hdr.References ?? '';
  const references = refRaw
    ? String(refRaw)
        .split(/\s+/)
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  return {
    id: m.id,
    from: {
      name: m.from_name || m.from_email.split('@')[0],
      email: m.from_email,
      avatar: avatarFor(m.from_email),
      verified: false,
    },
    to: m.to_email,
    subject: m.subject || '(sin asunto)',
    preview: m.preview || '',
    body,
    summary: (m.preview || '').slice(0, 160),
    date: m.received_at,
    dateLabel: new Date(m.received_at).toLocaleString('es', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    timestamp: ts,
    unread: m.unread ? 1 : 0,
    starred: m.starred,
    pinned: m.pinned,
    hasAttachment: m.has_attachment,
    category: (m.category as MailCategory) || 'primary',
    folder: (m.folder as MailFolder) || 'inbox',
    // En enviados la "cuenta" es el remitente (nuestro alias); en inbox es el destinatario.
    account: m.folder === 'sent' ? m.from_email : m.to_email,
    section: sectionFor(ts),
    quickReplies: [],
    messageId: m.message_id ?? hdr['message-id'] ?? hdr['Message-ID'] ?? null,
    inReplyTo: hdr['in-reply-to'] ?? hdr['In-Reply-To'] ?? null,
    references,
  };
}

export async function fetchInboundMessages(projectId: string, folder?: string, to?: string) {
  const params = new URLSearchParams({ projectId });
  if (folder) params.set('folder', folder);
  if (to) params.set('to', to);
  const res = await api<{ messages: ApiInboundMessage[] }>(`/api/inbound?${params}`);
  return res.messages.map(mapInboundToEmail);
}

export async function patchInboundMessage(
  id: string,
  updates: Partial<{
    folder: string;
    starred: boolean;
    pinned: boolean;
    unread: boolean;
  }>,
) {
  return api<{ message: ApiInboundMessage }>(`/api/inbound/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Borra mensajes de prueba (@example.com) del proyecto. */
export async function purgeDemoInboundMessages(projectId: string) {
  return api<{ deleted: number }>(`/api/inbound/purge-demo?projectId=${projectId}`, {
    method: 'POST',
  });
}

const ACCOUNT_COLORS = ['#2dd4bf', '#a78bfa', '#60a5fa', '#fbbf24', '#f472b6', '#34d399'];

export function aliasesToAccounts(
  aliases: Array<{ id: string; full_email: string; local_part: string }>,
): MailAccount[] {
  return aliases.map((a, i) => ({
    id: a.id,
    email: a.full_email,
    label: a.local_part,
    color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
  }));
}
