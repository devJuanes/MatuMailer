import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createProjectSchema, createTokenSchema } from '@matumailer/shared';
import { apiTokensRepo, projectsRepo, templatesRepo } from '@matumailer/database';
import { nanoid } from 'nanoid';
import { API_TOKEN_PREFIX } from '@matumailer/shared';
import { encrypt, hashToken, decrypt } from '../lib/crypto.js';
import { getProjectSetupStatus } from '../lib/project-setup.js';
import { SYSTEM_TEMPLATES } from '../lib/email-templates.js';
import { z } from 'zod';

export async function projectsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get('/', { preHandler: [app.authenticate], schema: { tags: ['Projects'] } }, async (request) => {
    const projects = await projectsRepo.findProjectsByUserId(request.userId!);
    return { projects };
  });

  server.post(
    '/',
    {
      preHandler: [app.authenticate],
      schema: { body: createProjectSchema, tags: ['Projects'] },
    },
    async (request, reply) => {
      const { name, slug, description } = request.body;
      const existing = await projectsRepo.findProjectBySlug(request.userId!, slug);
      if (existing) {
        return reply.status(409).send({ error: 'Conflict', message: 'Slug already exists' });
      }

      const project = await projectsRepo.createProject({
        user_id: request.userId!,
        name,
        slug,
        description: description ?? null,
      });

      for (const tpl of SYSTEM_TEMPLATES) {
        await templatesRepo.createTemplate({
          project_id: project.id,
          slug: tpl.slug,
          name: tpl.name,
          subject: tpl.subject,
          html_content: tpl.html_content,
          builder_data: null,
          variables: tpl.variables as unknown as string[],
          is_system: true,
        });
      }

      return reply.status(201).send({ project });
    },
  );

  server.get(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['Projects'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.id);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      return { project };
    },
  );

  server.delete(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['Projects'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.id);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      await projectsRepo.deleteProject(project.id);
      return reply.send({ success: true });
    },
  );

  server.get(
    '/:id/setup',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['Projects'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.id);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const setup = await getProjectSetupStatus(project.id);
      return { setup };
    },
  );

  server.get(
    '/:id/tokens',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['API Tokens'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.id);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const tokens = await apiTokensRepo.findTokensByProjectId(project.id);
      return { tokens };
    },
  );

  server.post(
    '/:id/tokens',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: createTokenSchema,
        tags: ['API Tokens'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.id);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const rawToken = `${API_TOKEN_PREFIX}${nanoid(32)}`;
      const expiresAt = request.body.expiresInDays
        ? new Date(Date.now() + request.body.expiresInDays * 86400000).toISOString()
        : null;

      const token = await apiTokensRepo.createApiToken({
        project_id: project.id,
        name: request.body.name,
        token_hash: hashToken(rawToken),
        token_prefix: rawToken.slice(0, 12),
        token_encrypted: encrypt(rawToken),
        expires_at: expiresAt,
      });

      const { token_hash: _, token_encrypted: __, ...safe } = token;
      return reply.status(201).send({
        token: { ...safe, can_copy: true },
        secret: rawToken,
      });
    },
  );

  server.get(
    '/:id/tokens/:tokenId/secret',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid(), tokenId: z.string().uuid() }),
        tags: ['API Tokens'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.id);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const token = await apiTokensRepo.findTokenById(request.params.tokenId);
      if (!token || token.project_id !== project.id) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      if (!token.token_encrypted) {
        return reply.status(400).send({
          error: 'NO_STORED_SECRET',
          message: 'Este token es anterior: genera uno nuevo para poder copiarlo.',
        });
      }
      return { secret: decrypt(token.token_encrypted) };
    },
  );

  server.delete(
    '/:id/tokens/:tokenId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid(), tokenId: z.string().uuid() }),
        tags: ['API Tokens'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.id);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      await apiTokensRepo.deleteApiToken(request.params.tokenId);
      return reply.send({ success: true });
    },
  );
}
