import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { templateCreateSchema, templateUpdateSchema } from '@matumailer/shared';
import { projectsRepo, templatesRepo } from '@matumailer/database';
import { z } from 'zod';
import { extractVariables, renderTemplate } from '../lib/template-engine.js';
import { assertCanCreateTemplate } from '../services/plan.service.js';
import { replyPlanLimitError } from '../lib/plan-errors.js';

async function requireProjectFromApiToken(
  projectId: string | undefined,
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
) {
  if (!projectId) {
    reply.status(401).send({
      error: 'No autorizado',
      message: 'Usa un token de API del proyecto (mm_live_...)',
    });
    return null;
  }
  const project = await projectsRepo.findProjectById(projectId);
  if (!project) {
    reply.status(404).send({ error: 'Not Found' });
    return null;
  }
  return project;
}

export async function templatesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // ── API token (Android / SDK / cURL) — proyecto viene del token ──────────

  server.get(
    '/',
    {
      preHandler: [app.authenticateApiToken],
      schema: { tags: ['Templates'] },
    },
    async (request, reply) => {
      const project = await requireProjectFromApiToken(request.projectId, reply);
      if (!project) return;
      const templates = await templatesRepo.findTemplatesByProjectId(project.id);
      return { templates };
    },
  );

  server.get(
    '/slug/:slug',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        params: z.object({ slug: z.string().min(1).max(50) }),
        tags: ['Templates'],
      },
    },
    async (request, reply) => {
      const project = await requireProjectFromApiToken(request.projectId, reply);
      if (!project) return;
      const template = await templatesRepo.findTemplateBySlug(project.id, request.params.slug);
      if (!template) {
        return reply.status(404).send({ error: 'Not Found', message: 'Plantilla no encontrada' });
      }
      return { template };
    },
  );

  server.post(
    '/',
    {
      preHandler: [app.authenticateApiToken],
      schema: { body: templateCreateSchema, tags: ['Templates'] },
    },
    async (request, reply) => {
      const project = await requireProjectFromApiToken(request.projectId, reply);
      if (!project) return;

      try {
        await assertCanCreateTemplate(project.user_id);
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        throw err;
      }

      const body = request.body;
      const variables =
        body.variables.length > 0
          ? body.variables
          : extractVariables(body.htmlContent + body.subject);

      const existing = await templatesRepo.findTemplateBySlug(project.id, body.slug);
      if (existing) {
        return reply.status(409).send({
          error: 'SLUG_EXISTS',
          message: `Ya existe una plantilla con slug "${body.slug}"`,
        });
      }

      const template = await templatesRepo.createTemplate({
        project_id: project.id,
        slug: body.slug,
        name: body.name,
        subject: body.subject,
        html_content: body.htmlContent,
        builder_data: body.builderData ?? null,
        variables,
        is_system: false,
      });

      return reply.status(201).send({ template });
    },
  );

  server.patch(
    '/id/:templateId',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        params: z.object({ templateId: z.string().uuid() }),
        body: templateUpdateSchema,
        tags: ['Templates'],
      },
    },
    async (request, reply) => {
      const project = await requireProjectFromApiToken(request.projectId, reply);
      if (!project) return;

      const existing = await templatesRepo.findTemplateById(request.params.templateId);
      if (!existing || existing.project_id !== project.id) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const body = request.body;
      const htmlContent = body.htmlContent ?? existing.html_content;
      const subject = body.subject ?? existing.subject;
      const variables =
        body.variables ??
        (body.htmlContent || body.subject
          ? extractVariables(htmlContent + subject)
          : existing.variables);

      if (body.slug && body.slug !== existing.slug) {
        const clash = await templatesRepo.findTemplateBySlug(project.id, body.slug);
        if (clash) {
          return reply.status(409).send({
            error: 'SLUG_EXISTS',
            message: `Ya existe una plantilla con slug "${body.slug}"`,
          });
        }
      }

      const template = await templatesRepo.updateTemplate(existing.id, {
        ...(body.name && { name: body.name }),
        ...(body.slug && { slug: body.slug }),
        ...(body.subject && { subject: body.subject }),
        ...(body.htmlContent && { html_content: body.htmlContent }),
        ...(body.builderData !== undefined && { builder_data: body.builderData }),
        variables,
      });

      return { template };
    },
  );

  server.delete(
    '/id/:templateId',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        params: z.object({ templateId: z.string().uuid() }),
        tags: ['Templates'],
      },
    },
    async (request, reply) => {
      const project = await requireProjectFromApiToken(request.projectId, reply);
      if (!project) return;

      const existing = await templatesRepo.findTemplateById(request.params.templateId);
      if (!existing || existing.project_id !== project.id) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      if (existing.is_system) {
        return reply
          .status(403)
          .send({ error: 'Forbidden', message: 'Cannot delete system template' });
      }

      await templatesRepo.deleteTemplate(existing.id);
      return { success: true };
    },
  );

  server.post(
    '/preview',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        body: z.object({
          htmlContent: z.string(),
          subject: z.string(),
          data: z.record(z.unknown()).optional(),
        }),
        tags: ['Templates'],
      },
    },
    async (request, reply) => {
      const project = await requireProjectFromApiToken(request.projectId, reply);
      if (!project) return;

      const rendered = renderTemplate(
        request.body.htmlContent,
        request.body.subject,
        request.body.data ?? {},
      );
      return { preview: rendered };
    },
  );

  // ── Session (dashboard) — projectId en la URL ────────────────────────────

  server.get(
    '/:projectId',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['Templates'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const templates = await templatesRepo.findTemplatesByProjectId(project.id);
      return { templates };
    },
  );

  server.post(
    '/:projectId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: templateCreateSchema,
        tags: ['Templates'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      try {
        await assertCanCreateTemplate(request.userId!);
      } catch (err) {
        if (replyPlanLimitError(reply, err)) return;
        throw err;
      }

      const body = request.body;
      const variables =
        body.variables.length > 0
          ? body.variables
          : extractVariables(body.htmlContent + body.subject);

      const template = await templatesRepo.createTemplate({
        project_id: project.id,
        slug: body.slug,
        name: body.name,
        subject: body.subject,
        html_content: body.htmlContent,
        builder_data: body.builderData ?? null,
        variables,
        is_system: false,
      });

      return reply.status(201).send({ template });
    },
  );

  server.patch(
    '/:projectId/:templateId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid(), templateId: z.string().uuid() }),
        body: templateUpdateSchema,
        tags: ['Templates'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const existing = await templatesRepo.findTemplateById(request.params.templateId);
      if (!existing || existing.project_id !== project.id) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const body = request.body;
      const htmlContent = body.htmlContent ?? existing.html_content;
      const subject = body.subject ?? existing.subject;
      const variables =
        body.variables ??
        (body.htmlContent || body.subject
          ? extractVariables(htmlContent + subject)
          : existing.variables);

      const template = await templatesRepo.updateTemplate(existing.id, {
        ...(body.name && { name: body.name }),
        ...(body.slug && { slug: body.slug }),
        ...(body.subject && { subject: body.subject }),
        ...(body.htmlContent && { html_content: body.htmlContent }),
        ...(body.builderData !== undefined && { builder_data: body.builderData }),
        variables,
      });

      return { template };
    },
  );

  server.post(
    '/:projectId/preview',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: z.object({
          htmlContent: z.string(),
          subject: z.string(),
          data: z.record(z.unknown()).optional(),
        }),
        tags: ['Templates'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const rendered = renderTemplate(
        request.body.htmlContent,
        request.body.subject,
        request.body.data ?? {},
      );
      return { preview: rendered };
    },
  );

  server.delete(
    '/:projectId/:templateId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid(), templateId: z.string().uuid() }),
        tags: ['Templates'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const existing = await templatesRepo.findTemplateById(request.params.templateId);
      if (!existing || existing.project_id !== project.id) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      if (existing.is_system) {
        return reply
          .status(403)
          .send({ error: 'Forbidden', message: 'Cannot delete system template' });
      }

      await templatesRepo.deleteTemplate(existing.id);
      return reply.send({ success: true });
    },
  );
}
