import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  buildDeliverabilityReport,
  detectSmtpProvider,
  isFromDomainAligned,
  smtpConfigSchema,
  smtpDetectSchema,
} from '@matumailer/shared';
import { onboardingRepo, projectsRepo, smtpConfigsRepo } from '@matumailer/database';
import { z } from 'zod';
import { encrypt } from '../lib/crypto.js';
import { checkDomainAuth } from '../lib/dns-check.js';
import { testSmtpConnection } from '../services/email.service.js';
import { assertCanConfigureSmtp } from '../services/plan.service.js';
import { replyPlanLimitError } from '../lib/plan-errors.js';

export async function smtpRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/detect',
    {
      preHandler: [app.authenticate],
      schema: { body: smtpDetectSchema, tags: ['SMTP'] },
    },
    async (request) => {
      const preset = detectSmtpProvider(request.body.email);
      if (!preset) {
        return { detected: false, provider: 'custom' as const };
      }
      return {
        detected: true,
        provider: preset.provider,
        host: preset.host,
        port: preset.port,
        secure: preset.secure,
      };
    },
  );

  server.get(
    '/:projectId/dns',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['SMTP'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const config = await smtpConfigsRepo.findSmtpByProjectId(project.id);
      if (!config) {
        return reply.status(400).send({ error: 'Bad Request', message: 'SMTP not configured' });
      }
      const domain = config.from_email.split('@')[1];
      if (!domain) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid from email' });
      }
      const dns = await checkDomainAuth(domain);
      return { dns };
    },
  );

  server.get(
    '/:projectId/deliverability',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['SMTP'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const config = await smtpConfigsRepo.findSmtpByProjectId(project.id);
      const report = buildDeliverabilityReport(config);
      return { report };
    },
  );

  server.get(
    '/:projectId',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['SMTP'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const config = await smtpConfigsRepo.findSmtpByProjectId(project.id);
      if (!config) return { config: null };
      const { password_encrypted: _, ...safe } = config;
      return { config: safe };
    },
  );

  server.put(
    '/:projectId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: smtpConfigSchema,
        tags: ['SMTP'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const body = request.body;

      try {
        await assertCanConfigureSmtp(request.userId!, project.id, body.username);
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        throw err;
      }

      const existing = await smtpConfigsRepo.findSmtpByProjectId(project.id);
      const passwordEncrypted =
        body.password && body.password !== 'placeholder'
          ? encrypt(body.password)
          : (existing?.password_encrypted ?? encrypt(body.password));

      const config = await smtpConfigsRepo.upsertSmtpConfig(project.id, {
        provider: body.provider,
        host: body.host,
        port: body.port,
        secure: body.secure,
        username: body.username,
        password_encrypted: passwordEncrypted,
        from_email: body.fromEmail,
        from_name: body.fromName ?? null,
      });

      await onboardingRepo.markSmtpCompleted(project.id);

      const aligned = isFromDomainAligned(config);
      const { password_encrypted: _, ...safe } = config;
      return {
        config: safe,
        deliverability: buildDeliverabilityReport(config),
        warnings: aligned
          ? []
          : [
              'El correo remitente debe usar el mismo dominio que el usuario SMTP para evitar spam (SPF).',
            ],
      };
    },
  );

  server.post(
    '/:projectId/test',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['SMTP'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const config = await smtpConfigsRepo.findSmtpByProjectId(project.id);
      if (!config) {
        return reply.status(400).send({ error: 'Bad Request', message: 'SMTP not configured' });
      }

      try {
        const ok = await testSmtpConnection(config);
        if (ok) {
          await smtpConfigsRepo.markSmtpVerified(project.id);
          await onboardingRepo.markSmtpCompleted(project.id);
        }
        return { success: ok, verified: ok };
      } catch (err) {
        return reply.status(400).send({
          success: false,
          message: err instanceof Error ? err.message : 'Connection failed',
        });
      }
    },
  );
}
