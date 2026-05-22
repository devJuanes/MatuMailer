import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  analyzeEmailSchema,
  buildDeliverabilityReport,
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
import { sendEmail } from '../services/email.service.js';
import { enqueueScheduledEmail } from '../services/schedule.service.js';

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
          const scheduled = await enqueueScheduledEmail(
            request.projectId!,
            body,
            body.scheduledAt,
          );
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
        const rendered = renderTemplate(
          template.html_content,
          template.subject,
          body.data ?? {},
        );
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
        const scheduled = await enqueueScheduledEmail(
          project.id,
          request.body,
          request.body.scheduledAt,
        );
        return reply.status(201).send({ scheduled });
      } catch (err) {
        const code = err instanceof Error ? err.message : 'SCHEDULE_FAILED';
        const status =
          code === 'INVALID_SCHEDULE_TIME' || code === 'SCHEDULE_TOO_SOON' ? 400 : 500;
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
        const result = await sendEmail({
          projectId: project.id,
          to: body.to,
          subject: body.subject,
          template: body.template,
          html: body.html,
          text: body.text,
          data: body.data,
        });
        await onboardingRepo.markTestEmailSent(project.id);
        return { success: true, ...result };
      } catch (err) {
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
