import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  buildDeliverabilityReport,
  detectSmtpProvider,
  isFromDomainAligned,
  normalizeSmtpEmail,
  normalizeSmtpPassword,
  normalizeSmtpUsername,
  smtpAuthErrorMessage,
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
      const rawPassword = body.password?.trim() ?? '';
      const isPlaceholder = !rawPassword || rawPassword === 'placeholder';

      if (!existing && isPlaceholder) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'La contraseña de aplicación es obligatoria al configurar SMTP por primera vez.',
        });
      }

      const passwordEncrypted = !isPlaceholder
        ? encrypt(normalizeSmtpPassword(body.provider, rawPassword))
        : existing!.password_encrypted;

      const config = await smtpConfigsRepo.upsertSmtpConfig(project.id, {
        provider: body.provider,
        host: body.host,
        port: body.port,
        secure: body.secure,
        username: normalizeSmtpUsername(body.username),
        password_encrypted: passwordEncrypted,
        from_email: normalizeSmtpEmail(body.fromEmail),
        from_name: body.fromName?.trim() ?? null,
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
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: smtpConfigSchema.partial().optional(),
        tags: ['SMTP'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const stored = await smtpConfigsRepo.findSmtpByProjectId(project.id);
      const body = request.body;

      if (!stored && !body) {
        return reply.status(400).send({ error: 'Bad Request', message: 'SMTP not configured' });
      }

      const rawPassword = body?.password?.trim() ?? '';
      const isPlaceholder = !rawPassword || rawPassword === 'placeholder';
      const provider = body?.provider ?? stored?.provider ?? 'custom';

      if (!stored && isPlaceholder) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Indica la contraseña de aplicación antes de probar la conexión.',
        });
      }

      const testConfig = {
        provider,
        host: body?.host ?? stored!.host,
        port: body?.port ?? stored!.port,
        secure: body?.secure ?? stored!.secure,
        username: normalizeSmtpUsername(body?.username ?? stored!.username),
        password_encrypted: !isPlaceholder
          ? encrypt(normalizeSmtpPassword(provider, rawPassword))
          : stored!.password_encrypted,
        from_email: normalizeSmtpEmail(body?.fromEmail ?? stored!.from_email),
        from_name: body?.fromName?.trim() ?? stored!.from_name,
        is_verified: stored?.is_verified ?? false,
        project_id: project.id,
        id: stored?.id ?? '',
        created_at: stored?.created_at ?? new Date().toISOString(),
        updated_at: stored?.updated_at ?? new Date().toISOString(),
      };

      try {
        const ok = await testSmtpConnection(testConfig);
        if (ok && stored) {
          await smtpConfigsRepo.markSmtpVerified(project.id);
          await onboardingRepo.markSmtpCompleted(project.id);
        }
        return { success: ok, verified: ok && !!stored };
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Connection failed';
        return reply.status(400).send({
          success: false,
          message: smtpAuthErrorMessage(provider, raw),
        });
      }
    },
  );
}
