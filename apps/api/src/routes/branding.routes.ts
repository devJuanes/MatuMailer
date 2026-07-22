import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { brandingRepo, projectsRepo } from '@matumailer/database';
import { z } from 'zod';

export async function brandingRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/:projectId',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['Branding'] },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const branding = await brandingRepo.getByProject(project.id);
      return {
        branding: branding ?? {
          project_id: project.id,
          company_name: null,
          logo_url: null,
          primary_color: '#c9a227',
          header_html: null,
          footer_html: null,
          tracking_enabled: true,
        },
      };
    },
  );

  server.put(
    '/:projectId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: z.object({
          company_name: z.string().max(150).optional().nullable(),
          logo_url: z.string().url().optional().nullable().or(z.literal('')),
          primary_color: z.string().max(20).optional(),
          header_html: z.string().max(20000).optional().nullable(),
          footer_html: z.string().max(20000).optional().nullable(),
          tracking_enabled: z.boolean().optional(),
        }),
        tags: ['Branding'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.params.projectId);
      if (!project || project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const logo = request.body.logo_url === '' ? null : (request.body.logo_url ?? undefined);
      const branding = await brandingRepo.upsert(project.id, {
        ...request.body,
        logo_url: logo,
      });
      return { branding };
    },
  );
}
