import type { SendEmailPayload } from '@matumailer/shared';
import {
  campaignsRepo,
  contactsRepo,
  scheduledEmailsRepo,
  templatesRepo,
} from '@matumailer/database';
import { renderTemplate } from '../lib/template-engine.js';
import { humanizeEmailError } from '../lib/humanize-error.js';
import { sendEmail } from './email.service.js';
import { assertCanSendForProject } from './plan.service.js';

const MIN_LEAD_MS = 60_000;

export function assertFutureSchedule(scheduledAt: string): Date {
  const at = new Date(scheduledAt);
  if (Number.isNaN(at.getTime())) {
    throw new Error('INVALID_SCHEDULE_TIME');
  }
  if (at.getTime() < Date.now() + MIN_LEAD_MS) {
    throw new Error('SCHEDULE_TOO_SOON');
  }
  return at;
}

export function primaryRecipient(to: string | string[]): string {
  return Array.isArray(to) ? to[0] : to;
}

export async function resolveScheduleSubject(
  projectId: string,
  payload: SendEmailPayload,
): Promise<string> {
  if (payload.subject?.trim()) return payload.subject.trim();
  if (payload.template) {
    const tpl = await templatesRepo.findTemplateBySlug(projectId, payload.template);
    if (tpl) {
      const { subject } = renderTemplate(tpl.html_content, tpl.subject, payload.data ?? {});
      return subject;
    }
  }
  return 'Correo programado';
}

export async function enqueueScheduledEmail(
  projectId: string,
  payload: SendEmailPayload,
  scheduledAt: string,
  campaignId?: string | null,
) {
  assertFutureSchedule(scheduledAt);
  const subject = await resolveScheduleSubject(projectId, payload);
  const { scheduledAt: _s, ...sendPayload } = payload;

  return scheduledEmailsRepo.createScheduledEmail({
    project_id: projectId,
    to_email: primaryRecipient(payload.to),
    subject,
    payload: sendPayload,
    scheduled_at: new Date(scheduledAt).toISOString(),
    campaign_id: campaignId ?? null,
  });
}

/** Encola N jobs durables para un grupo (sobrevive reload). */
export async function enqueueGroupCampaign(options: {
  projectId: string;
  groupId: string;
  template?: string;
  subject?: string;
  html?: string;
  data?: Record<string, unknown>;
  scheduledAt: string;
  campaignName?: string;
}) {
  assertFutureSchedule(options.scheduledAt);
  const members = await contactsRepo.listByGroup(options.groupId);
  if (!members.length) throw new Error('GROUP_EMPTY');

  const campaign = await campaignsRepo.create({
    project_id: options.projectId,
    name: options.campaignName ?? `Campaña ${new Date().toLocaleString('es')}`,
    template_slug: options.template ?? null,
    group_id: options.groupId,
    status: 'pending',
    scheduled_at: new Date(options.scheduledAt).toISOString(),
    total_count: members.length,
  });

  const jobs = [];
  for (const member of members) {
    const payload: SendEmailPayload = {
      to: member.email,
      template: options.template,
      subject: options.subject,
      html: options.html,
      data: {
        ...(options.data ?? {}),
        ...(member.metadata as Record<string, unknown>),
        nombre: member.name ?? '',
        primerNombre: (member.name ?? '').split(' ')[0] ?? '',
        email: member.email,
      },
    };
    const subject = await resolveScheduleSubject(options.projectId, payload);
    jobs.push(
      await scheduledEmailsRepo.createScheduledEmail({
        project_id: options.projectId,
        to_email: member.email,
        subject,
        payload,
        scheduled_at: new Date(options.scheduledAt).toISOString(),
        campaign_id: campaign.id,
      }),
    );
  }

  return { campaign, jobs, total: jobs.length };
}

/** Encola bulk programado (JSON recipients) como jobs durables. */
export async function enqueueBulkCampaign(options: {
  projectId: string;
  recipients: Array<{ email: string; data?: Record<string, unknown>; name?: string | null }>;
  template?: string;
  subject?: string;
  html?: string;
  scheduledAt: string;
  campaignName?: string;
}) {
  assertFutureSchedule(options.scheduledAt);
  if (!options.recipients.length) throw new Error('NO_RECIPIENTS');

  const campaign = await campaignsRepo.create({
    project_id: options.projectId,
    name: options.campaignName ?? `Masivo ${new Date().toLocaleString('es')}`,
    template_slug: options.template ?? null,
    status: 'pending',
    scheduled_at: new Date(options.scheduledAt).toISOString(),
    total_count: options.recipients.length,
  });

  const jobs = [];
  for (const r of options.recipients) {
    const payload: SendEmailPayload = {
      to: r.email,
      template: options.template,
      subject: options.subject,
      html: options.html,
      data: {
        ...(r.data ?? {}),
        nombre: r.data?.nombre ?? r.name ?? '',
        email: r.email,
      },
    };
    const subject = await resolveScheduleSubject(options.projectId, payload);
    jobs.push(
      await scheduledEmailsRepo.createScheduledEmail({
        project_id: options.projectId,
        to_email: r.email,
        subject,
        payload,
        scheduled_at: new Date(options.scheduledAt).toISOString(),
        campaign_id: campaign.id,
      }),
    );
  }

  return { campaign, jobs, total: jobs.length };
}

export async function processScheduledEmailQueue(): Promise<number> {
  await scheduledEmailsRepo.resetStaleProcessing();
  const due = await scheduledEmailsRepo.findDuePending(25);
  let processed = 0;

  for (const job of due) {
    await scheduledEmailsRepo.markProcessing(job.id);
    try {
      await assertCanSendForProject(job.project_id, { count: 1 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await scheduledEmailsRepo.markFailed(job.id, humanizeEmailError(message));
      if (job.campaign_id) {
        await campaignsRepo.incrementCounts(job.campaign_id, { failed: 1 });
      }
      processed += 1;
      continue;
    }
    try {
      const payload = job.payload as SendEmailPayload;
      const result = await sendEmail({
        projectId: job.project_id,
        ...payload,
        campaignId: job.campaign_id ?? null,
      });
      await scheduledEmailsRepo.markSent(job.id, result.id);
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await scheduledEmailsRepo.markFailed(job.id, humanizeEmailError(message));
      // sendEmail ya incrementó failed_count de la campaña si aplica
      processed += 1;
    }
  }

  return processed;
}

export function startScheduleWorker(log = console.log): () => void {
  const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 30_000);
  const tick = () => {
    processScheduledEmailQueue()
      .then((n) => {
        if (n > 0) log(`[scheduler] Procesados ${n} envío(s) programado(s)`);
      })
      .catch((err) => log('[scheduler] Error:', err));
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}
