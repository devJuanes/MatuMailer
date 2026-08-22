import type { InboxEmail } from './types';

/** Normaliza Message-ID al formato RFC `<id@host>`. */
export function normalizeMessageId(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  let t = id.trim();
  if (!t.startsWith('<')) t = `<${t}`;
  if (!t.endsWith('>')) t = `${t}>`;
  return t;
}

/** Construye In-Reply-To y References para responder en el mismo hilo. */
export function buildReplyHeaders(email: InboxEmail): Record<string, string> {
  const target = normalizeMessageId(email.messageId);
  if (!target) return {};

  const refs: string[] = [];
  for (const r of email.references ?? []) {
    const n = normalizeMessageId(r);
    if (n && !refs.includes(n)) refs.push(n);
  }
  const irt = normalizeMessageId(email.inReplyTo);
  if (irt && !refs.includes(irt)) refs.push(irt);
  if (!refs.includes(target)) refs.push(target);

  return {
    'In-Reply-To': target,
    References: refs.join(' '),
  };
}

export function replySubject(subject: string): string {
  const s = subject.trim();
  if (/^re:/i.test(s)) return s;
  return `Re: ${s}`;
}
