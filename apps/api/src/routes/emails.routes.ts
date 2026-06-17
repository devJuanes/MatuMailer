import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  analyzeEmailSchema,
  buildDeliverabilityReport,
  bulkSendEmailSchema,
  bulkSendFromJsonSchema,
  parseRecipientsFromJson,
  scheduleEmailSchema,
  sendEmailSchema,
  sendTestEmailSchema,
} from '@matumailer/shared';
import {
  emailLogsRepo,
  onboardingRepo,
  projectsRepo,
  scheduledEmailsRepo,
  smtpConfigsRepo,
  templatesRepo,
} from '@matumailer/database';
import { z } from 'zod';
import { renderTemplate } from '../lib/template-engine.js';
import { sendBulkEmail, sendEmail } from '../services/email.service.js';
import { enqueueScheduledEmail } from '../services/schedule.service.js';
import { assertCanSendForProject } from '../services/plan.service.js';
import { replyPlanLimitError } from '../lib/plan-errors.js';

export async function emailsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/send',
    {
      preHandler: [app.authenticateApiToken],
      schema: { body: sendEmailSchema, tags: ['Emails'] },
    },
    async (request, reply) => {
      try {
        const body = request.body;
        if (body.scheduledAt) {
          await assertCanSendForProject(request.projectId!, { schedule: true });
        }
        const recipients = Array.isArray(body.to) ? body.to : [body.to];
        if (recipients.length > 1) {
          await assertCanSendForProject(request.projectId!, {
            bulk: true,
            count: recipients.length,
          });
        } else {
          await assertCanSendForProject(request.projectId!, { count: 1 });
        }

        if (body.scheduledAt) {
          const scheduled = await enqueueScheduledEmail(request.projectId!, body, body.scheduledAt);
          return reply.status(201).send({
            success: true,
            scheduled: true,
            id: scheduled.id,
            status: scheduled.status,
            scheduledAt: scheduled.scheduled_at,
          });
        }
        const result = await sendEmail({
          projectId: request.projectId!,
          ...body,
        });
        return { success: true, scheduled: false, ...result };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const code = err instanceof Error ? err.message : 'SEND_FAILED';
        const status =
          code === 'SMTP_NOT_CONFIGURED' ||
          code === 'SMTP_NOT_VERIFIED' ||
          code === 'SMTP_FROM_DOMAIN_MISMATCH' ||
          code === 'INVALID_SCHEDULE_TIME' ||
          code === 'SCHEDULE_TOO_SOON'
            ? 400
            : 500;
        return reply.status(status).send({
          error: code,
          message: err instanceof Error ? err.message : 'Failed to send email',
        });
      }
    },
  );

  server.get(
    '/:projectId/logs',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(50),
          status: z.enum(['queued', 'sent', 'failed', 'bounced']).optional(),
        }),
        tags: ['Emails'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const logs = await emailLogsRepo.findEmailLogsByProjectId(project.id, {
        limit: request.query.limit,
        status: request.query.status,
      });
      return { logs };
    },
  );

  server.get(
    '/:projectId/stats',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['Emails'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const stats = await emailLogsRepo.getEmailStats(project.id);
      return { stats };
    },
  );

  server.post(
    '/:projectId/analyze',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: analyzeEmailSchema,
        tags: ['Emails'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const body = request.body;
      const smtp = await smtpConfigsRepo.findSmtpByProjectId(project.id);
      let subject = body.subject ?? '';
      let html = body.html ?? '';

      if (body.template) {
        const template = await templatesRepo.findTemplateBySlug(project.id, body.template);
        if (!template) {
          return reply.status(404).send({ error: 'Not Found', message: 'Template not found' });
        }
        const rendered = renderTemplate(template.html_content, template.subject, body.data ?? {});
        html = rendered.html;
        subject = body.subject ?? rendered.subject;
      }

      const report = buildDeliverabilityReport(smtp, subject, html || '<p></p>');
      return { report };
    },
  );

  server.get(
    '/:projectId/scheduled',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }),
        tags: ['Scheduled Emails'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const scheduled = await scheduledEmailsRepo.findScheduledByProjectId(
        project.id,
        request.query.limit,
      );
      return { scheduled };
    },
  );

  server.post(
    '/:projectId/scheduled',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: scheduleEmailSchema,
        tags: ['Scheduled Emails'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      try {
        await assertCanSendForProject(project.id, { schedule: true });
        const scheduled = await enqueueScheduledEmail(
          project.id,
          request.body,
          request.body.scheduledAt,
        );
        return reply.status(201).send({ scheduled });
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const code = err instanceof Error ? err.message : 'SCHEDULE_FAILED';
        const status = code === 'INVALID_SCHEDULE_TIME' || code === 'SCHEDULE_TOO_SOON' ? 400 : 500;
        return reply.status(status).send({
          error: code,
          message:
            code === 'SCHEDULE_TOO_SOON'
              ? 'La fecha debe ser al menos 1 minuto en el futuro'
              : err instanceof Error
                ? err.message
                : 'No se pudo programar',
        });
      }
    },
  );

  server.delete(
    '/:projectId/scheduled/:scheduledId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({
          projectId: z.string().uuid(),
          scheduledId: z.string().uuid(),
        }),
        tags: ['Scheduled Emails'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const existing = await scheduledEmailsRepo.findScheduledById(request.params.scheduledId);
      if (!existing || existing.project_id !== project.id) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const cancelled = await scheduledEmailsRepo.cancelScheduled(existing.id);
      if (!cancelled) {
        return reply.status(400).send({
          error: 'Cannot cancel',
          message: 'Solo se pueden cancelar envíos pendientes',
        });
      }
      return { scheduled: cancelled };
    },
  );

  server.post(
    '/:projectId/bulk',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: bulkSendEmailSchema,
        tags: ['Emails'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      try {
        await assertCanSendForProject(project.id, {
          bulk: true,
          count: request.body.recipients.length,
        });
        const result = await sendBulkEmail({
          projectId: project.id,
          ...request.body,
        });
        return { success: true, ...result };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const code = err instanceof Error ? err.message : 'BULK_SEND_FAILED';
        const status =
          code === 'SMTP_NOT_CONFIGURED' ||
          code === 'SMTP_NOT_VERIFIED' ||
          code === 'SMTP_FROM_DOMAIN_MISMATCH' ||
          code === 'TEMPLATE_NOT_FOUND'
            ? 400
            : 500;
        return reply.status(status).send({
          error: code,
          message: err instanceof Error ? err.message : 'No se pudo completar el envío masivo',
        });
      }
    },
  );

  server.post(
    '/send/bulk',
    {
      preHandler: [app.authenticateApiToken],
      schema: { body: bulkSendEmailSchema, tags: ['Emails'] },
    },
    async (request, reply) => {
      if (!request.projectId) {
        return reply.status(401).send({
          error: 'No autorizado',
          message: 'Usa un token de API del proyecto (mm_live_...)',
        });
      }
      try {
        await assertCanSendForProject(request.projectId, {
          bulk: true,
          count: request.body.recipients.length,
        });
        const result = await sendBulkEmail({
          projectId: request.projectId,
          ...request.body,
        });
        return { success: true, ...result };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const code = err instanceof Error ? err.message : 'BULK_SEND_FAILED';
        const status =
          code === 'SMTP_NOT_CONFIGURED' ||
          code === 'SMTP_NOT_VERIFIED' ||
          code === 'SMTP_FROM_DOMAIN_MISMATCH' ||
          code === 'TEMPLATE_NOT_FOUND'
            ? 400
            : 500;
        return reply.status(status).send({
          error: code,
          message: err instanceof Error ? err.message : 'No se pudo completar el envío masivo',
        });
      }
    },
  );

  server.post(
    '/send/bulk-from-json',
    {
      preHandler: [app.authenticateApiToken],
      schema: { body: bulkSendFromJsonSchema, tags: ['Emails'] },
    },
    async (request, reply) => {
      if (!request.projectId) {
        return reply.status(401).send({
          error: 'No autorizado',
          message: 'Usa un token de API del proyecto (mm_live_...)',
        });
      }

      try {
        const { users, emailField, fieldMapping, excludeFields, ...sendOptions } = request.body;
        const parsed = parseRecipientsFromJson(users, {
          emailField,
          fieldMapping,
          excludeFields,
        });

        if (parsed.recipients.length === 0) {
          return reply.status(400).send({
            error: 'NO_RECIPIENTS',
            message: 'No se encontraron destinatarios válidos en el JSON',
          });
        }

        await assertCanSendForProject(request.projectId, {
          bulk: true,
          count: parsed.recipients.length,
        });

        const result = await sendBulkEmail({
          projectId: request.projectId,
          ...sendOptions,
          recipients: parsed.recipients,
        });

        return {
          success: true,
          emailField: parsed.emailField,
          skipped: parsed.skipped,
          ...result,
        };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const code = err instanceof Error ? err.message : 'BULK_SEND_FAILED';
        const status =
          code === 'EMAIL_FIELD_NOT_FOUND' ||
          code === 'SMTP_NOT_CONFIGURED' ||
          code === 'SMTP_NOT_VERIFIED' ||
          code === 'SMTP_FROM_DOMAIN_MISMATCH' ||
          code === 'TEMPLATE_NOT_FOUND'
            ? 400
            : 500;
        return reply.status(status).send({
          error: code,
          message:
            code === 'EMAIL_FIELD_NOT_FOUND'
              ? 'No se detectó un campo de correo en el JSON. Usa emailField para indicarlo.'
              : err instanceof Error
                ? err.message
                : 'No se pudo completar el envío masivo',
        });
      }
    },
  );

  server.post(
    '/:projectId/test',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: sendTestEmailSchema,
        tags: ['Emails'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const body = request.body;
      try {
        await assertCanSendForProject(project.id, { isTest: true });
        const result = await sendEmail({
          projectId: project.id,
          to: body.to,
          subject: body.subject,
          template: body.template,
          html: body.html,
          text: body.text,
          data: body.data,
          logMetadata: { isTest: true },
        });
        await onboardingRepo.markTestEmailSent(project.id);
        return { success: true, ...result };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const message = err instanceof Error ? err.message : 'Failed to send test email';
        const status =
          message === 'SMTP_NOT_CONFIGURED' ||
          message === 'SMTP_NOT_VERIFIED' ||
          message === 'SMTP_FROM_DOMAIN_MISMATCH' ||
          message === 'TEMPLATE_NOT_FOUND'
            ? 400
            : 500;
        return reply.status(status).send({
          error: 'SEND_FAILED',
          message,
        });
      }
    },
  );
}
