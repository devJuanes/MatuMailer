import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Capa de entrega. MatuMailer no usa SMTP del cliente: el proveedor es interno
 * (Postfix local, consola de desarrollo, o un ESP futuro).
 */
export interface EmailDkimConfig {
  domainName: string;
  keySelector: string;
  privateKey: string;
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  /** MAIL FROM / Return-Path (alineación SPF/DMARC). */
  envelopeFrom?: string;
  /** Firma DKIM del mensaje exacto que se envía (nodemailer). */
  dkim?: EmailDkimConfig;
}

export interface EmailResult {
  accepted: boolean;
  provider: string;
  messageId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

export type PlatformTransportMode = 'postfix' | 'console';

export function resolvePlatformTransportMode(): PlatformTransportMode {
  const raw = (process.env.MATUMAILER_TRANSPORT ?? 'postfix').trim().toLowerCase();
  if (raw === 'console' || raw === 'stub' || raw === 'json') return 'console';
  // `smtp` queda como alias interno del relay de plataforma (no SMTP del usuario).
  return 'postfix';
}

function buildPostfixTransport(dkim?: EmailDkimConfig): Transporter {
  const host = process.env.MATUMAILER_RELAY_HOST || process.env.SMTP_HOST || '127.0.0.1';
  const port = process.env.MATUMAILER_RELAY_PORT
    ? Number(process.env.MATUMAILER_RELAY_PORT)
    : process.env.SMTP_PORT
      ? Number(process.env.SMTP_PORT)
      : 25;
  const secure = process.env.MATUMAILER_RELAY_SECURE === 'true' || port === 465;
  const user = process.env.MATUMAILER_RELAY_USER || process.env.SMTP_USER;
  const pass = process.env.MATUMAILER_RELAY_PASS || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10_000,
    greetingTimeout: 5_000,
    ...(dkim
      ? {
          dkim: {
            domainName: dkim.domainName,
            keySelector: dkim.keySelector,
            privateKey: dkim.privateKey,
            // Cabeceras que Gmail/Yahoo esperan firmadas para buena reputación.
            headerFieldNames:
              'from:sender:reply-to:subject:date:message-id:to:cc:mime-version:content-type:content-transfer-encoding:list-unsubscribe:list-unsubscribe-post:feedback-id',
            skipFields: 'bcc:dkim-signature',
          },
        }
      : {}),
  });
}

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async send(message: EmailMessage): Promise<EmailResult> {
    console.log(`\n[email-provider:console] ──────── EMAIL SIMULADO ────────`);
    console.log(`[email-provider:console] from:    ${message.from}`);
    console.log(`[email-provider:console] to:      ${message.to}`);
    console.log(`[email-provider:console] subject: ${message.subject}`);
    console.log(`[email-provider:console] replyTo: ${message.replyTo ?? '(none)'}`);
    console.log(`[email-provider:console] envelope:${message.envelopeFrom ?? '(default)'}`);
    console.log(`[email-provider:console] ──────────────────────────────────\n`);
    return { accepted: true, provider: this.name };
  }
}

export class PostfixEmailProvider implements EmailProvider {
  readonly name = 'postfix';

  async send(message: EmailMessage): Promise<EmailResult> {
    const transport = buildPostfixTransport(message.dkim);
    try {
      const info = await transport.sendMail({
        from: message.from,
        replyTo: message.replyTo,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
        encoding: 'utf-8',
        // Sin Priority/Importance altos: esos headers aumentan spam score.
        ...(message.envelopeFrom
          ? { envelope: { from: message.envelopeFrom, to: message.to } }
          : {}),
      });
      return {
        accepted: true,
        provider: this.name,
        messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
      };
    } finally {
      transport.close();
    }
  }
}

export function createEmailProvider(mode = resolvePlatformTransportMode()): EmailProvider {
  if (mode === 'console') return new ConsoleEmailProvider();
  return new PostfixEmailProvider();
}
