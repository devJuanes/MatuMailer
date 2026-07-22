import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contactsRepo, contactGroupsRepo, projectsRepo } from '@matumailer/database';
import { z } from 'zod';

async function assertProject(userId: string, projectId: string) {
  const project = await projectsRepo.findProjectById(projectId);
  if (!project || project.user_id !== userId) return null;
  return project;
}

export async function contactsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/:projectId',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['Contacts'] },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      const contacts = await contactsRepo.listByProject(project.id);
      return { contacts };
    },
  );

  server.post(
    '/:projectId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: z.object({
          email: z.string().email(),
          name: z.string().max(150).optional(),
          metadata: z.record(z.unknown()).optional(),
        }),
        tags: ['Contacts'],
      },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      try {
        const contact = await contactsRepo.create({
          project_id: project.id,
          email: request.body.email,
          name: request.body.name,
          metadata: request.body.metadata,
        });
        return reply.status(201).send({ contact });
      } catch (err) {
        return reply.status(400).send({
          error: 'CREATE_FAILED',
          message: err instanceof Error ? err.message : 'Failed',
        });
      }
    },
  );

  server.post(
    '/:projectId/import',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: z.object({
          contacts: z
            .array(
              z.object({
                email: z.string().email(),
                name: z.string().max(150).optional().nullable(),
                metadata: z.record(z.unknown()).optional(),
              }),
            )
            .min(1)
            .max(2000),
        }),
        tags: ['Contacts'],
      },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      const contacts = await contactsRepo.upsertMany(project.id, request.body.contacts);
      return { imported: contacts.length, contacts };
    },
  );

  server.delete(
    '/:projectId/:contactId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({
          projectId: z.string().uuid(),
          contactId: z.string().uuid(),
        }),
        tags: ['Contacts'],
      },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      await contactsRepo.remove(request.params.contactId);
      return { success: true };
    },
  );

  // Groups
  server.get(
    '/:projectId/groups',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ projectId: z.string().uuid() }), tags: ['Groups'] },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      const groups = await contactGroupsRepo.listByProject(project.id);
      return { groups };
    },
  );

  server.post(
    '/:projectId/groups',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ projectId: z.string().uuid() }),
        body: z.object({
          name: z.string().min(1).max(100),
          description: z.string().max(500).optional().nullable(),
          contactIds: z.array(z.string().uuid()).optional(),
        }),
        tags: ['Groups'],
      },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      const group = await contactGroupsRepo.create({
        project_id: project.id,
        name: request.body.name,
        description: request.body.description,
      });
      if (request.body.contactIds?.length) {
        await contactGroupsRepo.setMembers(group.id, request.body.contactIds);
      }
      return reply.status(201).send({ group });
    },
  );

  server.put(
    '/:projectId/groups/:groupId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({
          projectId: z.string().uuid(),
          groupId: z.string().uuid(),
        }),
        body: z.object({
          name: z.string().min(1).max(100).optional(),
          description: z.string().max(500).optional().nullable(),
          contactIds: z.array(z.string().uuid()).optional(),
        }),
        tags: ['Groups'],
      },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      const group = await contactGroupsRepo.findById(request.params.groupId);
      if (!group || group.project_id !== project.id) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const updated = await contactGroupsRepo.update(group.id, {
        name: request.body.name,
        description: request.body.description,
      });
      if (request.body.contactIds) {
        await contactGroupsRepo.setMembers(group.id, request.body.contactIds);
      }
      return { group: updated };
    },
  );

  server.get(
    '/:projectId/groups/:groupId/members',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({
          projectId: z.string().uuid(),
          groupId: z.string().uuid(),
        }),
        tags: ['Groups'],
      },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      const contacts = await contactsRepo.listByGroup(request.params.groupId);
      return { contacts };
    },
  );

  server.delete(
    '/:projectId/groups/:groupId',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({
          projectId: z.string().uuid(),
          groupId: z.string().uuid(),
        }),
        tags: ['Groups'],
      },
    },
    async (request, reply) => {
      const project = await assertProject(request.userId!, request.params.projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      await contactGroupsRepo.remove(request.params.groupId);
      return { success: true };
    },
  );
}
