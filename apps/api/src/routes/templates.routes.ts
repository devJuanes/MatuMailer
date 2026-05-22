import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { templateCreateSchema, templateUpdateSchema } from '@matumailer/shared';
import { projectsRepo, templatesRepo } from '@matumailer/database';
import { z } from 'zod';
import { extractVariables, renderTemplate } from '../lib/template-engine.js';

export async function templatesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

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
        return reply.status(403).send({ error: 'Forbidden', message: 'Cannot delete system template' });
      }

      await templatesRepo.deleteTemplate(existing.id);
      return reply.send({ success: true });
    },
  );
}
