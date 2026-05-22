import nodemailer, { type Transporter } from 'nodemailer';
import type { SmtpConfig } from '@matumailer/shared';
import {
  emailLogsRepo,
  smtpConfigsRepo,
  templatesRepo,
} from '@matumailer/database';
import { isFromDomainAligned } from '@matumailer/shared';
import { decrypt } from '../lib/crypto.js';
import {
  buildMessageId,
  formatFromAddress,
  prepareOutboundMail,
} from '../lib/deliverability-mail.js';
import { renderTemplate } from '../lib/template-engine.js';

export async function createTransporter(config: SmtpConfig): Promise<Transporter> {
  const password = decrypt(config.password_encrypted);
  const port = config.port;
  return nodemailer.createTransport({
    host: config.host,
    port,
    secure: config.secure || port === 465,
    requireTLS: port === 587,
    auth: {
      user: config.username,
      pass: password,
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
  });
}

export async function testSmtpConnection(config: SmtpConfig): Promise<boolean> {
  const transport = await createTransporter(config);
  try {
    await transport.verify();
    return true;
  } finally {
    transport.close();
  }
}

export interface SendEmailOptions {
  projectId: string;
  to: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  template?: string;
  data?: Record<string, unknown>;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string; status: string }> {
  const smtp = await smtpConfigsRepo.findSmtpByProjectId(options.projectId);
  if (!smtp) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }
  if (!smtp.is_verified) {
    throw new Error('SMTP_NOT_VERIFIED');
  }
  if (!isFromDomainAligned(smtp)) {
    throw new Error('SMTP_FROM_DOMAIN_MISMATCH');
  }

  let subject = options.subject ?? 'No Subject';
  let html = options.html ?? '';
  let text = options.text;
  let templateSlug: string | null = null;

  if (options.template) {
    const template = await templatesRepo.findTemplateBySlug(
      options.projectId,
      options.template,
    );
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    const rendered = renderTemplate(
      template.html_content,
      template.subject,
      options.data ?? {},
    );
    html = rendered.html;
    subject = options.subject ?? rendered.subject;
    templateSlug = template.slug;
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const primaryTo = recipients[0];

  const log = await emailLogsRepo.createEmailLog({
    project_id: options.projectId,
    to_email: primaryTo,
    subject,
    template_slug: templateSlug,
    status: 'queued',
    error_message: null,
    metadata: { recipients, data: options.data ?? {} },
    sent_at: null,
  });

  try {
    const prepared = prepareOutboundMail({
      subject,
      html: html || '<p></p>',
      text,
      fromEmail: smtp.from_email,
      fromName: smtp.from_name,
      logId: log.id,
    });

    const transport = await createTransporter(smtp);
    await transport.sendMail({
      from: formatFromAddress(smtp.from_email, smtp.from_name),
      replyTo: smtp.from_email,
      to: recipients.join(', '),
      subject: prepared.subject,
      html: prepared.html,
      text: prepared.text,
      headers: {
        ...prepared.headers,
        'Message-ID': buildMessageId(smtp.from_email),
      },
      encoding: 'utf-8',
      priority: 'normal',
    });
    transport.close();

    await emailLogsRepo.updateEmailLogStatus(log.id, 'sent', {
      sent_at: new Date().toISOString(),
    });

    return { id: log.id, status: 'sent' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await emailLogsRepo.updateEmailLogStatus(log.id, 'failed', {
      error_message: message,
    });
    throw err;
  }
}
