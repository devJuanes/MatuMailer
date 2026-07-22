import crypto from 'crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import type { SmtpConfig } from '@matumailer/shared';
import {
  brandingRepo,
  campaignsRepo,
  contactsRepo,
  emailLogsRepo,
  smtpConfigsRepo,
  templatesRepo,
} from '@matumailer/database';
import {
  isFromDomainAligned,
  normalizeSmtpPassword,
  normalizeSmtpUsername,
} from '@matumailer/shared';
import { decrypt } from '../lib/crypto.js';
import {
  buildMessageId,
  formatFromAddress,
  prepareOutboundMail,
} from '../lib/deliverability-mail.js';
import { applyBranding, injectTracking } from '../lib/branding-render.js';
import { humanizeEmailError } from '../lib/humanize-error.js';
import { renderTemplate } from '../lib/template-engine.js';

function smtpAuth(config: SmtpConfig) {
  const user = normalizeSmtpUsername(config.username);
  const pass = normalizeSmtpPassword(config.provider, decrypt(config.password_encrypted));
  return { user, pass };
}

export async function createTransporter(config: SmtpConfig): Promise<Transporter> {
  const auth = smtpAuth(config);
  const port = config.port;

  if (config.provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth,
    });
  }

  return nodemailer.createTransport({
    host: config.host,
    port,
    secure: config.secure || port === 465,
    requireTLS: port === 587,
    auth,
    tls: {
      minVersion: 'TLSv1.2',
    },
  });
}

export async function testSmtpConnection(config: SmtpConfig): Promise<boolean> {
  const tryVerify = async (cfg: SmtpConfig) => {
    const transport = await createTransporter(cfg);
    try {
      await transport.verify();
      return true;
    } finally {
      transport.close();
    }
  };

  try {
    return await tryVerify(config);
  } catch (firstErr) {
    if (config.provider === 'gmail' && config.port === 587 && !config.secure) {
      return await tryVerify({ ...config, port: 465, secure: true });
    }
    throw firstErr;
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
  campaignId?: string | null;
  groupId?: string | null;
}

export interface BulkRecipient {
  email: string;
  data?: Record<string, unknown>;
  name?: string | null;
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    email: string;
    id?: string;
    status: string;
    error?: string;
    userMessage?: string;
  }>;
}

interface ResolvedMailContent {
  subject: string;
  html: string;
  text?: string;
  templateSlug: string | null;
}

function publicApiBase(): string {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.MATUMAILER_PUBLIC_URL ||
    `http://localhost:${process.env.PORT ?? 4000}`
  ).replace(/\/$/, '');
}

async function resolveMailContent(
  projectId: string,
  options: Pick<SendEmailOptions, 'subject' | 'html' | 'text' | 'template' | 'data'>,
): Promise<ResolvedMailContent> {
  let subject = options.subject ?? 'No Subject';
  let html = options.html ?? '';
  let text = options.text;
  let templateSlug: string | null = null;
  const branding = await brandingRepo.getByProject(projectId);

  if (options.template) {
    const template = await templatesRepo.findTemplateBySlug(projectId, options.template);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    const rendered = applyBranding(
      template.html_content,
      template.subject,
      options.data ?? {},
      branding,
    );
    html = rendered.html;
    subject = options.subject ?? rendered.subject;
    templateSlug = template.slug;
  } else if (html || subject) {
    const rendered = applyBranding(html || '<p></p>', subject, options.data ?? {}, branding);
    html = rendered.html;
    subject = rendered.subject;
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
  campaignId: string | null = null,
  groupId: string | null = null,
): Promise<{ id: string; status: string }> {
  const smtp = await assertSmtpReady(projectId);
  const branding = await brandingRepo.getByProject(projectId);
  const trackingToken = crypto.randomBytes(24).toString('hex');

  const log = await emailLogsRepo.createEmailLog({
    project_id: projectId,
    to_email: to,
    subject: content.subject,
    template_slug: content.templateSlug,
    status: 'queued',
    error_message: null,
    user_message: null,
    campaign_id: campaignId,
    group_id: groupId,
    tracking_token: trackingToken,
    metadata: { recipients: [to], data, ...logMetadata },
    sent_at: null,
  });

  try {
    let html = content.html || '<p></p>';
    if (branding?.tracking_enabled !== false) {
      html = injectTracking(html, trackingToken, publicApiBase());
    }

    const prepared = prepareOutboundMail({
      subject: content.subject,
      html,
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

    if (campaignId) {
      await campaignsRepo.incrementCounts(campaignId, { sent: 1 });
    }

    return { id: log.id, status: 'sent' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const userMessage = humanizeEmailError(message);
    await emailLogsRepo.updateEmailLogStatus(log.id, 'failed', {
      error_message: message,
      user_message: userMessage,
    });
    if (campaignId) {
      await campaignsRepo.incrementCounts(campaignId, { failed: 1 });
    }
    const e = new Error(message) as Error & { userMessage?: string };
    e.userMessage = userMessage;
    throw e;
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
      options.campaignId ?? null,
      options.groupId ?? null,
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
    campaignId: options.campaignId,
    groupId: options.groupId,
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
  campaignId?: string | null;
  groupId?: string | null;
}): Promise<BulkSendResult> {
  await assertSmtpReady(options.projectId);

  const template = options.template
    ? await templatesRepo.findTemplateBySlug(options.projectId, options.template)
    : null;

  if (options.template && !template) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }

  const branding = await brandingRepo.getByProject(options.projectId);
  const results: BulkSendResult['results'] = [];
  let sent = 0;
  let failed = 0;
  const pauseMs = options.delayMs ?? 150;

  for (let i = 0; i < options.recipients.length; i++) {
    const recipient = options.recipients[i];
    try {
      const data = {
        ...(recipient.data ?? {}),
        nombre: recipient.data?.nombre ?? recipient.name ?? '',
        primerNombre: recipient.data?.primerNombre ?? (recipient.name ?? '').split(' ')[0] ?? '',
        email: recipient.email,
      };
      const content = template
        ? (() => {
            const rendered = applyBranding(template.html_content, template.subject, data, branding);
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
            data,
          });

      const result = await sendEmailToOne(
        options.projectId,
        recipient.email,
        content,
        data,
        {},
        options.campaignId ?? null,
        options.groupId ?? null,
      );
      sent++;
      results.push({ email: recipient.email, id: result.id, status: 'sent' });
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : 'Unknown error';
      const userMessage =
        (err as Error & { userMessage?: string }).userMessage ?? humanizeEmailError(message);
      results.push({
        email: recipient.email,
        status: 'failed',
        error: message,
        userMessage,
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

export async function sendToGroup(options: {
  projectId: string;
  groupId: string;
  template?: string;
  subject?: string;
  html?: string;
  data?: Record<string, unknown>;
  campaignName?: string;
}): Promise<BulkSendResult & { campaignId: string }> {
  const members = await contactsRepo.listByGroup(options.groupId);
  if (!members.length) throw new Error('GROUP_EMPTY');

  const campaign = await campaignsRepo.create({
    project_id: options.projectId,
    name: options.campaignName ?? `Grupo ${new Date().toISOString()}`,
    template_slug: options.template ?? null,
    group_id: options.groupId,
    status: 'processing',
    total_count: members.length,
  });

  const result = await sendBulkEmail({
    projectId: options.projectId,
    template: options.template,
    subject: options.subject,
    html: options.html,
    recipients: members.map((c) => ({
      email: c.email,
      name: c.name,
      data: {
        ...(options.data ?? {}),
        ...(c.metadata as Record<string, unknown>),
        nombre: c.name ?? '',
      },
    })),
    campaignId: campaign.id,
    groupId: options.groupId,
  });

  await campaignsRepo.updateStatus(campaign.id, 'completed');
  return { ...result, campaignId: campaign.id };
}
