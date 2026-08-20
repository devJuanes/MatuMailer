import { randomUUID } from 'crypto';
import { htmlToPlainText, normalizeHtmlForInbox, sanitizeSubject } from '@matumailer/shared';

export interface PreparedOutboundMail {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

/** URL pública del API (tracking, List-Unsubscribe HTTPS). */
export function publicApiBase(): string {
  const raw =
    process.env.PUBLIC_API_URL ||
    process.env.MATUMAILER_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';
  if (raw.trim()) return raw.trim().replace(/\/$/, '');
  return `http://127.0.0.1:${process.env.PORT ?? 4001}`;
}

export function prepareOutboundMail(params: {
  subject: string;
  html: string;
  text?: string;
  fromEmail: string;
  fromName?: string | null;
  logId?: string;
  trackingToken?: string;
  projectId?: string;
  stream?: 'transactional' | 'bulk';
}): PreparedOutboundMail {
  const subject = sanitizeSubject(params.subject);
  const html = normalizeHtmlForInbox(params.html);
  const text =
    params.text?.trim() ||
    htmlToPlainText(html) ||
    'Consulta este mensaje en tu cliente de correo con soporte HTML.';

  const headers: Record<string, string> = {
    'X-Mailer': 'MatuMailer',
  };

  if (params.logId) {
    headers['X-Entity-Ref-ID'] = params.logId;
  }

  // Feedback-ID ayuda a Gmail Postmaster a atribuir quejas por stream/proyecto.
  if (params.projectId) {
    const stream = params.stream ?? 'transactional';
    const shortProject = params.projectId.replace(/-/g, '').slice(0, 12);
    headers['Feedback-ID'] = `${stream}:${shortProject}:matumailer`;
  }

  if (params.trackingToken) {
    const base = publicApiBase();
    const unsubHttps = `${base}/t/u/${params.trackingToken}`;
    const unsubMailto = `mailto:${params.fromEmail}?subject=unsubscribe`;
    headers['List-Unsubscribe'] = `<${unsubHttps}>, <${unsubMailto}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return {
    subject,
    html,
    text,
    headers,
  };
}

export function formatFromAddress(fromEmail: string, fromName?: string | null): string {
  const safeName = fromName?.trim().replace(/"/g, "'") ?? '';
  if (safeName) return `"${safeName}" <${fromEmail}>`;
  return fromEmail;
}

export function buildMessageId(fromEmail: string): string {
  const domain = fromEmail.split('@')[1] ?? 'matumailer.local';
  return `<${randomUUID()}@${domain}>`;
}

/** Envelope MAIL FROM alineado al dominio (SPF del apex). */
export function buildEnvelopeFrom(domainName: string, logId?: string): string {
  const tag = logId ? logId.replace(/-/g, '').slice(0, 10) : 'mail';
  return `bounce+${tag}@${domainName}`;
}
