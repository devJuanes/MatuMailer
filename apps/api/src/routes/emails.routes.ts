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
  templatesRepo,
  aliasesRepo,
  domainsRepo,
} from '@matumailer/database';
import { z } from 'zod';
import { renderTemplate } from '../lib/template-engine.js';
import { sendBulkEmail, sendEmail, sendToGroup } from '../services/email.service.js';
import {
  enqueueBulkCampaign,
  enqueueGroupCampaign,
  enqueueScheduledEmail,
} from '../services/schedule.service.js';
import { assertCanSendForProject } from '../services/plan.service.js';
import { replyPlanLimitError } from '../lib/plan-errors.js';
import { campaignsRepo, contactsRepo, emailEventsRepo } from '@matumailer/database';
import { humanizeEmailError, isClientEmailError, parseEmailErrorCode } from '../lib/humanize-error.js';

const groupSendBodySchema = z.object({
  groupId: z.string().uuid(),
  template: z.string().optional(),
  subject: z.string().optional(),
  html: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
  campaignName: z.string().max(150).optional(),
  from: z.string().email().optional(),
  fromName: z.string().max(120).optional(),
  domainId: z.string().uuid().optional(),
  aliasId: z.string().uuid().optional(),
});

/**
 * Resuelve el proyecto de envío y valida ownership.
 * - API key (`mm_live_`/`mm_test_`): siempre el `projectId` del token.
 * - JWT de sesión: `body.projectId` (o el único proyecto del usuario) debe
 *   pertenecer a `request.userId`.
 */
async function resolveAuthorizedProjectId(
  request: { projectId?: string; userId?: string },
  bodyProjectId?: string,
): Promise<
  | { ok: true; projectId: string }
  | { ok: false; status: number; payload: Record<string, unknown> }
> {
  if (request.projectId) {
    if (bodyProjectId && bodyProjectId !== request.projectId) {
      return {
        ok: false,
        status: 403,
        payload: {
          error: 'SENDING_IDENTITY_NOT_ALLOWED',
          message: 'La API key no puede enviar usando otro proyecto.',
        },
      };
    }
    return { ok: true, projectId: request.projectId };
  }

  if (!request.userId) {
    return {
      ok: false,
      status: 401,
      payload: { error: 'No autorizado', message: 'Token inválido' },
    };
  }

  let projectId = bodyProjectId ?? null;
  if (!projectId) {
    const projects = await projectsRepo.findProjectsByUserId(request.userId);
    if (projects.length === 1) projectId = projects[0].id;
  }
  if (!projectId) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: 'PROJECT_REQUIRED',
        message:
          'No se pudo inferir el proyecto. Pasa `projectId` en el body o usa un token `mm_live_...`.',
      },
    };
  }

  const project = await projectsRepo.findProjectById(projectId);
  if (!project || project.user_id !== request.userId) {
    return { ok: false, status: 404, payload: { error: 'Not Found' } };
  }
  return { ok: true, projectId };
}

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

        const resolved = await resolveAuthorizedProjectId(request, body.projectId);
        if (!resolved.ok) {
          return reply.status(resolved.status).send(resolved.payload);
        }
        const { projectId } = resolved;

        if (body.scheduledAt) {
          await assertCanSendForProject(projectId, { schedule: true });
        }
        const recipients = Array.isArray(body.to) ? body.to : [body.to];
        if (recipients.length > 1) {
          await assertCanSendForProject(projectId, {
            bulk: true,
            count: recipients.length,
          });
        } else {
          await assertCanSendForProject(projectId, { count: 1 });
        }

        if (body.scheduledAt) {
          const scheduled = await enqueueScheduledEmail(projectId, body, body.scheduledAt);
          return reply.status(201).send({
            success: true,
            scheduled: true,
            id: scheduled.id,
            status: scheduled.status,
            scheduledAt: scheduled.scheduled_at,
          });
        }
        const result = await sendEmail({
          projectId,
          ...body,
        });
        return { success: true, scheduled: false, ...result };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const message = err instanceof Error ? err.message : 'SEND_FAILED';
        const code = parseEmailErrorCode(message);
        return reply.status(isClientEmailError(message) ? 400 : 500).send({
          error: code,
          message,
          userMessage: humanizeEmailError(message),
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
      const events = await emailEventsRepo.countByProject(project.id);
      return { stats: { ...stats, ...events } };
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
      let fromEmail = body.from ?? '';
      let fromName: string | null = body.fromName ?? null;
      let domainVerified = false;
      let domainName = '';

      if (body.aliasId) {
        const found = await aliasesRepo.findAliasById(body.aliasId);
        if (found && found.projectId === project.id) {
          fromEmail = found.alias.full_email;
          fromName = found.alias.display_name;
          const domain = await domainsRepo.findDomainById(found.alias.domain_id);
          domainVerified = domain?.status === 'verified';
          domainName = domain?.domain ?? '';
        }
      } else if (fromEmail) {
        const alias = await aliasesRepo.findAliasByEmail(project.id, fromEmail);
        if (alias) {
          fromName = fromName ?? alias.display_name;
          const domain = await domainsRepo.findDomainById(alias.domain_id);
          domainVerified = domain?.status === 'verified';
          domainName = domain?.domain ?? '';
        }
      } else {
        const sendable = await aliasesRepo.listSendableAliases(
          project.id,
          body.domainId,
        );
        if (sendable.length === 1) {
          fromEmail = sendable[0].full_email;
          fromName = sendable[0].display_name;
          domainVerified = true;
          domainName = sendable[0].domain;
        } else if (sendable.length > 1) {
          const def = sendable.find((a) => a.is_default) ?? sendable[0];
          fromEmail = def.full_email;
          fromName = def.display_name;
          domainVerified = true;
          domainName = def.domain;
        }
      }

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

      const report = buildDeliverabilityReport(
        fromEmail
          ? { fromEmail, fromName, domainVerified, domainName }
          : null,
        subject,
        html || '<p></p>',
      );
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
        if (request.body.scheduledAt) {
          await assertCanSendForProject(project.id, {
            bulk: true,
            schedule: true,
            count: request.body.recipients.length,
          });
          const result = await enqueueBulkCampaign({
            projectId: project.id,
            recipients: request.body.recipients,
            template: request.body.template,
            subject: request.body.subject,
            scheduledAt: request.body.scheduledAt,
            campaignName: request.body.campaignName,
            from: request.body.from,
            fromName: request.body.fromName,
            domainId: request.body.domainId,
            aliasId: request.body.aliasId,
          });
          return reply.status(201).send({
            success: true,
            scheduled: true,
            campaignId: result.campaign.id,
            total: result.total,
          });
        }
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
          isClientEmailError(code) || parseEmailErrorCode(code) === 'TEMPLATE_NOT_FOUND'
            ? 400
            : 500;
        return reply.status(status).send({
          error: code,
          message: humanizeEmailError(code),
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
        if (request.body.scheduledAt) {
          await assertCanSendForProject(request.projectId, {
            bulk: true,
            schedule: true,
            count: request.body.recipients.length,
          });
          const result = await enqueueBulkCampaign({
            projectId: request.projectId,
            recipients: request.body.recipients,
            template: request.body.template,
            subject: request.body.subject,
            scheduledAt: request.body.scheduledAt,
            campaignName: request.body.campaignName,
            from: request.body.from,
            fromName: request.body.fromName,
            domainId: request.body.domainId,
            aliasId: request.body.aliasId,
          });
          return reply.status(201).send({
            success: true,
            scheduled: true,
            campaignId: result.campaign.id,
            total: result.total,
          });
        }
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
          isClientEmailError(code) || parseEmailErrorCode(code) === 'TEMPLATE_NOT_FOUND'
            ? 400
            : 500;
        return reply.status(status).send({
          error: code,
          message: humanizeEmailError(code),
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
          isClientEmailError(code) ||
          parseEmailErrorCode(code) === 'TEMPLATE_NOT_FOUND'
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
    '/send/group',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        body: groupSendBodySchema,
        tags: ['Emails'],
      },
    },
    async (request, reply) => {
      if (!request.projectId) {
        return reply.status(401).send({ error: 'No autorizado' });
      }
      try {
        if (request.body.scheduledAt) {
          await assertCanSendForProject(request.projectId, { schedule: true, bulk: true });
          const result = await enqueueGroupCampaign({
            projectId: request.projectId,
            groupId: request.body.groupId,
            template: request.body.template,
            subject: request.body.subject,
            html: request.body.html,
            data: request.body.data,
            scheduledAt: request.body.scheduledAt,
            campaignName: request.body.campaignName,
            from: request.body.from,
            fromName: request.body.fromName,
            domainId: request.body.domainId,
            aliasId: request.body.aliasId,
          });
          return reply.status(201).send({
            success: true,
            scheduled: true,
            campaignId: result.campaign.id,
            total: result.total,
          });
        }
        const members = await contactsRepo.listByGroup(request.body.groupId);
        await assertCanSendForProject(request.projectId, {
          bulk: true,
          count: Math.max(members.length, 1),
        });
        const result = await sendToGroup({
          projectId: request.projectId,
          groupId: request.body.groupId,
          template: request.body.template,
          subject: request.body.subject,
          html: request.body.html,
          data: request.body.data,
          campaignName: request.body.campaignName,
          from: request.body.from,
          fromName: request.body.fromName,
          domainId: request.body.domainId,
          aliasId: request.body.aliasId,
        });
        return { success: true, scheduled: false, ...result };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const code = err instanceof Error ? err.message : 'GROUP_SEND_FAILED';
        return reply.status(400).send({
          error: code,
          message: humanizeEmailError(code),
        });
      }
    },
  );

  server.post(
    '/:projectId/group',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: groupSendBodySchema,
        tags: ['Emails'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      try {
        if (request.body.scheduledAt) {
          await assertCanSendForProject(project.id, { schedule: true, bulk: true });
          const result = await enqueueGroupCampaign({
            projectId: project.id,
            ...request.body,
            scheduledAt: request.body.scheduledAt,
          });
          return reply.status(201).send({
            success: true,
            scheduled: true,
            campaignId: result.campaign.id,
            total: result.total,
          });
        }
        const members = await contactsRepo.listByGroup(request.body.groupId);
        await assertCanSendForProject(project.id, {
          bulk: true,
          count: Math.max(members.length, 1),
        });
        const result = await sendToGroup({
          projectId: project.id,
          groupId: request.body.groupId,
          template: request.body.template,
          subject: request.body.subject,
          html: request.body.html,
          data: request.body.data,
          campaignName: request.body.campaignName,
          from: request.body.from,
          fromName: request.body.fromName,
          domainId: request.body.domainId,
          aliasId: request.body.aliasId,
        });
        return { success: true, ...result };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const code = err instanceof Error ? err.message : 'GROUP_SEND_FAILED';
        return reply.status(400).send({ error: code, message: humanizeEmailError(code) });
      }
    },
  );

  server.get(
    '/:projectId/campaigns',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['Campaigns'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const campaigns = await campaignsRepo.listByProject(project.id);
      return { campaigns };
    },
  );

  server.post(
    '/:projectId/campaigns/:campaignId/cancel',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({
          projectId: z.string().uuid(),
          campaignId: z.string().uuid(),
        }),
        tags: ['Campaigns'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const cancelled = await campaignsRepo.cancelPending(request.params.campaignId);
      if (!cancelled) {
        return reply.status(400).send({ error: 'Cannot cancel' });
      }
      const n = await scheduledEmailsRepo.cancelByCampaign(request.params.campaignId);
      return { campaign: cancelled, cancelledJobs: n };
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
          from: body.from,
          fromName: body.fromName,
          domainId: body.domainId,
          aliasId: body.aliasId,
          logMetadata: { isTest: true },
        });
        await onboardingRepo.markTestEmailSent(project.id);
        return { success: true, ...result };
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        const message = err instanceof Error ? err.message : 'Failed to send test email';
        const code = parseEmailErrorCode(message);
        return reply.status(isClientEmailError(message) ? 400 : 500).send({
          error: code,
          message,
          userMessage: humanizeEmailError(message),
        });
      }
    },
  );
}
