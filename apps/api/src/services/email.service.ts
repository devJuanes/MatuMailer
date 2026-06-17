import nodemailer, { type Transporter } from 'nodemailer';
import type { SmtpConfig } from '@matumailer/shared';
import { emailLogsRepo, smtpConfigsRepo, templatesRepo } from '@matumailer/database';
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
  logMetadata?: Record<string, unknown>;
}

export interface BulkRecipient {
  email: string;
  data?: Record<string, unknown>;
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{ email: string; id?: string; status: string; error?: string }>;
}

interface ResolvedMailContent {
  subject: string;
  html: string;
  text?: string;
  templateSlug: string | null;
}

async function resolveMailContent(
  projectId: string,
  options: Pick<SendEmailOptions, 'subject' | 'html' | 'text' | 'template' | 'data'>,
): Promise<ResolvedMailContent> {
  let subject = options.subject ?? 'No Subject';
  let html = options.html ?? '';
  let text = options.text;
  let templateSlug: string | null = null;

  if (options.template) {
    const template = await templatesRepo.findTemplateBySlug(projectId, options.template);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    const rendered = renderTemplate(template.html_content, template.subject, options.data ?? {});
    html = rendered.html;
    subject = options.subject ?? rendered.subject;
    templateSlug = template.slug;
  }

  return { subject, html, text, templateSlug };
}

async function assertSmtpReady(projectId: string) {
  const smtp = await smtpConfigsRepo.findSmtpByProjectId(projectId);
  if (!smtp) throw new Error('SMTP_NOT_CONFIGURED');
  if (!smtp.is_verified) throw new Error('SMTP_NOT_VERIFIED');
  if (!isFromDomainAligned(smtp)) throw new Error('SMTP_FROM_DOMAIN_MISMATCH');
  return smtp;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEmailToOne(
  projectId: string,
  to: string,
  content: ResolvedMailContent,
  data: Record<string, unknown> = {},
  logMetadata: Record<string, unknown> = {},
): Promise<{ id: string; status: string }> {
  const smtp = await assertSmtpReady(projectId);

  const log = await emailLogsRepo.createEmailLog({
    project_id: projectId,
    to_email: to,
    subject: content.subject,
    template_slug: content.templateSlug,
    status: 'queued',
    error_message: null,
    metadata: { recipients: [to], data, ...logMetadata },
    sent_at: null,
  });

  try {
    const prepared = prepareOutboundMail({
      subject: content.subject,
      html: content.html || '<p></p>',
      text: content.text,
      fromEmail: smtp.from_email,
      fromName: smtp.from_name,
      logId: log.id,
    });

    const transport = await createTransporter(smtp);
    await transport.sendMail({
      from: formatFromAddress(smtp.from_email, smtp.from_name),
      replyTo: smtp.from_email,
      to,
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

export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ id: string; status: string }> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  if (recipients.length === 1) {
    const content = await resolveMailContent(options.projectId, options);
    return sendEmailToOne(
      options.projectId,
      recipients[0],
      content,
      options.data ?? {},
      options.logMetadata ?? {},
    );
  }

  const bulk = await sendBulkEmail({
    projectId: options.projectId,
    template: options.template,
    subject: options.subject,
    html: options.html,
    text: options.text,
    recipients: recipients.map((email) => ({
      email,
      data: options.data ?? {},
    })),
  });

  if (bulk.failed > 0) {
    throw new Error(`BULK_PARTIAL_FAILURE:${bulk.sent}/${bulk.total}`);
  }

  const first = bulk.results.find((r) => r.id);
  return { id: first?.id ?? 'bulk', status: 'sent' };
}

export async function sendBulkEmail(options: {
  projectId: string;
  template?: string;
  subject?: string;
  html?: string;
  text?: string;
  recipients: BulkRecipient[];
  delayMs?: number;
}): Promise<BulkSendResult> {
  await assertSmtpReady(options.projectId);

  const template = options.template
    ? await templatesRepo.findTemplateBySlug(options.projectId, options.template)
    : null;

  if (options.template && !template) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }

  const results: BulkSendResult['results'] = [];
  let sent = 0;
  let failed = 0;
  const pauseMs = options.delayMs ?? 150;

  for (let i = 0; i < options.recipients.length; i++) {
    const recipient = options.recipients[i];
    try {
      const content = template
        ? (() => {
            const rendered = renderTemplate(
              template.html_content,
              template.subject,
              recipient.data ?? {},
            );
            return {
              subject: options.subject ?? rendered.subject,
              html: rendered.html,
              text: options.text,
              templateSlug: template.slug,
            };
          })()
        : await resolveMailContent(options.projectId, {
            subject: options.subject,
            html: options.html,
            text: options.text,
            data: recipient.data,
          });

      const result = await sendEmailToOne(
        options.projectId,
        recipient.email,
        content,
        recipient.data ?? {},
      );
      sent++;
      results.push({ email: recipient.email, id: result.id, status: 'sent' });
    } catch (err) {
      failed++;
      results.push({
        email: recipient.email,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    if (pauseMs > 0 && i < options.recipients.length - 1) {
      await delay(pauseMs);
    }
  }

  return {
    total: options.recipients.length,
    sent,
    failed,
    results,
  };
}
