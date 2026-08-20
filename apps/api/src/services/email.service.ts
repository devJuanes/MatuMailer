import crypto from 'crypto';
import type { Domain } from '@matumailer/shared';
import {
  brandingRepo,
  campaignsRepo,
  contactsRepo,
  emailLogsRepo,
  templatesRepo,
} from '@matumailer/database';
import { decrypt } from '../lib/crypto.js';
import {
  buildMessageId,
  formatFromAddress,
  prepareOutboundMail,
} from '../lib/deliverability-mail.js';
import { applyBranding, injectTracking } from '../lib/branding-render.js';
import { humanizeEmailError } from '../lib/humanize-error.js';
import { signDkim } from '../lib/dkim-sign.js';
import { createEmailProvider, type EmailProvider } from '../providers/email-provider.js';
import { resolveSendingIdentity } from './sending-identity.js';

interface ResolvedFrom {
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  domain: Domain;
  aliasId: string;
}

export interface SendResult {
  id: string;
  status: string;
  from: string;
  aliasId: string;
  domainId: string;
}

interface OutboundTransport {
  provider: EmailProvider;
  dkimDomain: string;
  dkimSelector: string;
  dkimPrivateKey: string;
}

async function resolveFromAndDomain(
  projectId: string,
  override: { from?: string; fromName?: string; domainId?: string; aliasId?: string },
): Promise<ResolvedFrom> {
  const resolved = await resolveSendingIdentity({
    projectId,
    from: override.from,
    fromName: override.fromName,
    domainId: override.domainId,
    aliasId: override.aliasId,
  });
  return {
    fromEmail: resolved.fromEmail,
    fromName: resolved.fromName,
    replyTo: resolved.replyTo,
    domain: resolved.domain,
    aliasId: resolved.aliasId,
  };
}

async function getOutboundTransport(domain: Domain): Promise<OutboundTransport> {
  const provider = createEmailProvider();
  if (provider.name === 'console') {
    return {
      provider,
      dkimDomain: domain.domain,
      dkimSelector: domain.dkim_selector,
      dkimPrivateKey: '',
    };
  }
  return {
    provider,
    dkimDomain: domain.domain,
    dkimSelector: domain.dkim_selector,
    dkimPrivateKey: decrypt(domain.dkim_private_key_encrypted),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PREPARACIÓN DE MENSAJES
// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAddressList(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * Construye el mensaje MIME crudo para firmar DKIM. Lo usamos antes de pasar
 * por nodemailer para que la firma cubra exactamente los headers que verá el
 * receptor. (Nodemailer lo reordena ligeramente si lo construimos con su API.)
 */
function buildMimeMessage(params: {
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string | null;
  cc?: string;
  bcc?: string;
  headers?: Record<string, string>;
  messageId: string;
  date: string;
  listUnsubscribe?: string | null;
}): string {
  const fromHeader = params.fromName
    ? `From: "${params.fromName.replace(/"/g, "'")}" <${params.from}>\r\n`
    : `From: ${params.from}\r\n`;
  const headers: string[] = [
    fromHeader,
    `To: ${params.to}\r\n`,
    params.replyTo ? `Reply-To: ${params.replyTo}\r\n` : '',
    params.cc ? `Cc: ${params.cc}\r\n` : '',
    params.bcc ? `Bcc: ${params.bcc}\r\n` : '',
    `Subject: ${params.subject}\r\n`,
    `Date: ${params.date}\r\n`,
    `Message-ID: ${params.messageId}\r\n`,
    `MIME-Version: 1.0\r\n`,
    `Content-Type: text/html; charset=utf-8\r\n`,
    `Content-Transfer-Encoding: quoted-printable\r\n`,
    params.listUnsubscribe ? `List-Unsubscribe: ${params.listUnsubscribe}\r\n` : '',
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n`,
  ];
  if (params.headers) {
    for (const [k, v] of Object.entries(params.headers)) headers.push(`${k}: ${v}\r\n`);
  }
  return headers.join('') + `\r\n${params.html}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVÍO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

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
  from?: string;
  fromName?: string;
  /** Forzar el dominio verificado cuando el proyecto tiene varios. */
  domainId?: string;
  /** Forzar el alias verificado cuando el proyecto tiene varios. */
  aliasId?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
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
    process.env.MATUMAILERER_URL ||
    `http://localhost:${process.env.PORT ?? 4001}`
  ).replace(/\/$/, '');
}

async function resolveMailContent(
  projectId: string,
  options: Pick<SendEmailOptions, 'subject' | 'html' | 'text' | 'template' | 'data'>,
): Promise<ResolvedMailContent> {
  let subject = options.subject ?? 'No Subject';
  let html = options.html ?? '';
  const text = options.text;
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

  return { subject, html, text: text ?? '', templateSlug };
}

async function sendEmailToOne(
  projectId: string,
  to: string,
  content: ResolvedMailContent,
  data: Record<string, unknown> = {},
  logMetadata: Record<string, unknown> = {},
  campaignId: string | null = null,
  groupId: string | null = null,
  overrides: {
    from?: string;
    fromName?: string;
    domainId?: string;
    aliasId?: string;
    replyTo?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    headers?: Record<string, string>;
    tags?: Array<{ name: string; value: string }>;
  } = {},
): Promise<SendResult> {
  const branding = await brandingRepo.getByProject(projectId);
  const trackingToken = crypto.randomBytes(24).toString('hex');

  // 1) Resolver `from` y dominio verificado
  const resolved = await resolveFromAndDomain(projectId, {
    from: overrides.from,
    fromName: overrides.fromName,
    domainId: overrides.domainId,
    aliasId: overrides.aliasId,
  });
  const fromEmail = resolved.fromEmail;
  const fromName = overrides.fromName ?? resolved.fromName;

  // 2) Construir transporte con DKIM del dominio
  const outbound = await getOutboundTransport(resolved.domain);

  const replyTo = normalizeAddressList(overrides.replyTo ?? resolved.replyTo ?? undefined);
  const cc = normalizeAddressList(overrides.cc);
  const bcc = normalizeAddressList(overrides.bcc);

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
    from_email: fromEmail,
    domain_id: resolved.domain.id,
    alias_id: resolved.aliasId,
    provider: outbound.provider.name,
    message_id: null,
    metadata: {
      recipients: [to],
      data,
      from: fromEmail,
      fromName,
      dkimDomainId: resolved.domain.id,
      aliasId: resolved.aliasId,
      provider: outbound.provider.name,
      ...logMetadata,
    },
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
      fromEmail,
      fromName,
      logId: log.id,
    });

    const messageId = buildMessageId(fromEmail);

    const listUnsubscribe =
      overrides.replyTo || fromEmail
        ? `<mailto:${resolved.replyTo ?? fromEmail}?subject=unsubscribe>`
        : null;

    const extraHeaders: Record<string, string> = {
      ...prepared.headers,
      'Message-ID': messageId,
    };

    if (overrides.headers) Object.assign(extraHeaders, overrides.headers);

    // Cabeceras estándar de entregabilidad
    extraHeaders['X-Mailer'] = 'MatuMailer';
    if (overrides.tags?.length) {
      for (const tag of overrides.tags) {
        extraHeaders[`X-MatuMailer-Tag-${tag.name}`] = tag.value;
      }
    }

    let dkimSignatureHeader: string | undefined;

    // En modo `console` no firmamos DKIM (no hay entrega real) y omitimos el
    // build del MIME message completo (que solo se usa para firmar).
    if (outbound.provider.name !== 'console')
      try {
        const mimeMessage = buildMimeMessage({
          from: fromEmail,
          fromName,
          to,
          subject: prepared.subject,
          text: prepared.text,
          html: prepared.html,
          replyTo: replyTo ?? null,
          cc,
          bcc,
          headers: extraHeaders,
          messageId,
          date: new Date().toUTCString(),
          listUnsubscribe,
        });
        dkimSignatureHeader = signDkim(mimeMessage, {
          selector: outbound.dkimSelector,
          domain: outbound.dkimDomain,
          privateKey: outbound.dkimPrivateKey,
        });
      } catch (dkimErr) {
        console.warn('[email.service] DKIM signing failed:', dkimErr);
      }

    if (dkimSignatureHeader) {
      const lines = dkimSignatureHeader.split(/\r?\n/);
      for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const name = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (name && value && !extraHeaders[name]) extraHeaders[name] = value;
      }
    }

    const delivery = await outbound.provider.send({
      from: formatFromAddress(fromEmail, fromName),
      replyTo,
      to,
      cc: overrides.cc,
      bcc: overrides.bcc,
      subject: prepared.subject,
      html: prepared.html,
      text: prepared.text,
      headers: extraHeaders,
    });

    await emailLogsRepo.updateEmailLogStatus(log.id, 'sent', {
      sent_at: new Date().toISOString(),
      message_id: delivery.messageId ?? messageId,
    });

    if (campaignId) {
      await campaignsRepo.incrementCounts(campaignId, { sent: 1 });
    }

    return { id: log.id, status: 'sent', from: fromEmail, aliasId: resolved.aliasId, domainId: resolved.domain.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(
      `[email.service] send failed for project=${projectId} to=${to} from=${fromEmail}:`,
      message,
      stack,
    );
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
): Promise<SendResult> {
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
      {
        from: options.from,
        fromName: options.fromName,
        domainId: options.domainId,
        aliasId: options.aliasId,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        headers: options.headers,
        tags: options.tags,
      },
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
    from: options.from,
    fromName: options.fromName,
    domainId: options.domainId,
    aliasId: options.aliasId,
    replyTo: options.replyTo,
    cc: options.cc,
    bcc: options.bcc,
    headers: options.headers,
    tags: options.tags,
  });

  if (bulk.failed > 0) {
    throw new Error(`BULK_PARTIAL_FAILURE:${bulk.sent}/${bulk.total}`);
  }

  const first = bulk.results.find((r) => r.id);
  return {
    id: first?.id ?? 'bulk',
    status: 'sent',
    from: bulk.from,
    aliasId: bulk.aliasId,
    domainId: bulk.domainId,
  };
}

export async function sendBulkEmail(options: {
  projectId: string;
  template?: string;
  subject?: string;
  html?: string;
  text?: string;
  recipients: Array<{ email: string; data?: Record<string, unknown>; name?: string | null }>;
  delayMs?: number;
  campaignId?: string | null;
  groupId?: string | null;
  from?: string;
  fromName?: string;
  domainId?: string;
  aliasId?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}): Promise<BulkSendResult> {
  const resolved = await resolveFromAndDomain(options.projectId, {
    from: options.from,
    fromName: options.fromName,
    domainId: options.domainId,
    aliasId: options.aliasId,
  });

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
        {
          from: resolved.fromEmail,
          fromName: options.fromName ?? resolved.fromName ?? undefined,
          domainId: resolved.domain.id,
          aliasId: resolved.aliasId,
          replyTo: options.replyTo,
          cc: options.cc,
          bcc: options.bcc,
          headers: options.headers,
          tags: options.tags,
        },
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
    from: resolved.fromEmail,
    aliasId: resolved.aliasId,
    domainId: resolved.domain.id,
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
  from?: string;
  fromName?: string;
  domainId?: string;
  aliasId?: string;
}): Promise<BulkSendResult & { campaignId: string }> {
  const members = await contactsRepo.listByGroup(options.groupId);
  if (!members.length) throw new Error('GROUP_EMPTY');

  const identity = await resolveFromAndDomain(options.projectId, {
    from: options.from,
    fromName: options.fromName,
    domainId: options.domainId,
    aliasId: options.aliasId,
  });

  const campaign = await campaignsRepo.create({
    project_id: options.projectId,
    name: options.campaignName ?? `Grupo ${new Date().toISOString()}`,
    template_slug: options.template ?? null,
    group_id: options.groupId,
    alias_id: identity.aliasId,
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
        ...options.data,
        ...(c.metadata as Record<string, unknown>),
        nombre: c.name ?? '',
      },
    })),
    campaignId: campaign.id,
    groupId: options.groupId,
    from: identity.fromEmail,
    fromName: options.fromName ?? identity.fromName ?? undefined,
    domainId: identity.domain.id,
    aliasId: identity.aliasId,
  });

  await campaignsRepo.updateStatus(campaign.id, 'completed');
  return { ...result, campaignId: campaign.id };
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
  from: string;
  aliasId: string;
  domainId: string;
  results: Array<{
    email: string;
    id?: string;
    status: string;
    error?: string;
    userMessage?: string;
  }>;
}
