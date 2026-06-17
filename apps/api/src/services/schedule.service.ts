import type { SendEmailPayload } from '@matumailer/shared';
import { scheduledEmailsRepo, templatesRepo } from '@matumailer/database';
import { renderTemplate } from '../lib/template-engine.js';
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
  });
}

export async function processScheduledEmailQueue(): Promise<number> {
  await scheduledEmailsRepo.resetStaleProcessing();
  const due = await scheduledEmailsRepo.findDuePending(25);
  let processed = 0;

  for (const job of due) {
    await scheduledEmailsRepo.markProcessing(job.id);
    try {
      await assertCanSendForProject(job.project_id, { count: 1 });
      const payload = job.payload as SendEmailPayload;
      const result = await sendEmail({
        projectId: job.project_id,
        ...payload,
      });
      await scheduledEmailsRepo.markSent(job.id, result.id);
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await scheduledEmailsRepo.markFailed(job.id, message);
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
