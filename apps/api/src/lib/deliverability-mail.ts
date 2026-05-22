import { randomUUID } from 'crypto';
import {
  htmlToPlainText,
  normalizeHtmlForInbox,
  sanitizeSubject,
} from '@matumailer/shared';

export interface PreparedOutboundMail {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export function prepareOutboundMail(params: {
  subject: string;
  html: string;
  text?: string;
  fromEmail: string;
  fromName?: string | null;
  logId?: string;
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
