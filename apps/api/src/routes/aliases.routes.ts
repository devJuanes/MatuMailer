import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createAliasSchema, listAliasesQuerySchema, updateAliasSchema } from '@matumailer/shared';
import { aliasesRepo, domainsRepo, projectsRepo } from '@matumailer/database';
import { z } from 'zod';

function ensureProjectAccess(
  project: { user_id: string } | null,
  userId: string | undefined,
): project is { user_id: string } {
  return !!project && !!userId && project.user_id === userId;
}

const idParam = z.object({ id: z.string().uuid() });

/**
 * CRUD de aliases por dominio verificado.
 *
 *  GET    /api/aliases?projectId=&domainId=&activeOnly=
 *  POST   /api/aliases                              body: { domainId, localPart, ... }
 *  PATCH  /api/aliases/:id                          body: { displayName?, replyTo?, isActive?, isDefault? }
 *  DELETE /api/aliases/:id
 *
 * Los aliases pertenecen a un `mailer_domains` (FK ON DELETE CASCADE). El
 * server garantiza que el alias pertenezca al proyecto que llama.
 */
export async function aliasesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Resuelve la fila cruda del alias y valida que su dominio pertenezca al
   * usuario que hace la petición. Devuelve `null` si no existe o no es del
   * usuario (en cuyo caso el caller responde 404).
   */
  async function assertAliasOwnership(aliasId: string, userId: string | undefined) {
    const { getMatuDb } = await import('@matumailer/database');
    const db = getMatuDb();
    const { data, error } = await db
      .from('mailer_domain_aliases')
      .select('*, mailer_domains!inner(project_id, status, domain)')
      .eq('id', aliasId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      id: string;
      domain_id: string;
      local_part: string;
      full_email: string;
      display_name: string | null;
      reply_to: string | null;
      is_active: boolean;
      is_default: boolean;
      created_at: string;
      updated_at: string;
      mailer_domains: { project_id: string; status: string; domain: string };
    };
    const project = await projectsRepo.findProjectById(row.mailer_domains.project_id);
    if (!ensureProjectAccess(project, userId)) return null;
    return row;
  }

  server.get(
    '/',
    {
      preHandler: [app.authenticate],
      schema: { querystring: listAliasesQuerySchema, tags: ['Aliases'] },
    },
    async (request, reply) => {
      const proj = await projectsRepo.findProjectById(request.query.projectId);
      if (!ensureProjectAccess(proj, request.userId)) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const aliases = await aliasesRepo.listAliases(request.query.projectId, {
        domainId: request.query.domainId,
        activeOnly: request.query.activeOnly,
      });
      return { aliases };
    },
  );

  server.post(
    '/',
    {
      preHandler: [app.authenticate],
      schema: { body: createAliasSchema, tags: ['Aliases'] },
    },
    async (request, reply) => {
      const { domainId, localPart, displayName, replyTo, isActive, isDefault } = request.body;

      const domain = await domainsRepo.findDomainById(domainId);
      if (!domain) return reply.status(404).send({ error: 'Domain not found' });
      const proj = await projectsRepo.findProjectById(domain.project_id);
      if (!ensureProjectAccess(proj, request.userId)) {
        return reply.status(404).send({ error: 'Domain not found' });
      }
      if (domain.status !== 'verified') {
        return reply.status(400).send({
          error: 'DOMAIN_NOT_VERIFIED',
          message: 'Solo puedes crear aliases sobre dominios verificados.',
        });
      }

      const fullEmail = `${localPart.toLowerCase()}@${domain.domain}`;

      try {
        // Si marca `is_default=true`, desmarcamos los demás del mismo dominio
        // para honrar el índice único parcial.
        if (isDefault) await aliasesRepo.unsetDefaultInDomain(domainId);

        const alias = await aliasesRepo.createAlias({
          domain_id: domainId,
          local_part: localPart.toLowerCase(),
          full_email: fullEmail,
          display_name: displayName ?? null,
          reply_to: replyTo ?? null,
          is_active: isActive,
          is_default: isDefault,
        });

        return reply.status(201).send({ alias });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo crear el alias';
        if (msg.includes('duplicate') || msg.includes('unique')) {
          return reply.status(409).send({
            error: 'ALIAS_EXISTS',
            message: `Ya existe el alias ${fullEmail} en este dominio.`,
          });
        }
        if (msg.includes('uq_mailer_domain_aliases_default')) {
          return reply.status(409).send({
            error: 'DEFAULT_ALREADY_SET',
            message: 'Ya hay otro alias marcado como default en este dominio. Desactívalo primero.',
          });
        }
        throw err;
      }
    },
  );

  server.patch(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: { params: idParam, body: updateAliasSchema, tags: ['Aliases'] },
    },
    async (request, reply) => {
      const existing = await assertAliasOwnership(request.params.id, request.userId);
      if (!existing) return reply.status(404).send({ error: 'Not Found' });

      const body = request.body;
      const updates: Record<string, unknown> = {};
      if (body.displayName !== undefined) updates.display_name = body.displayName;
      if (body.replyTo !== undefined) updates.reply_to = body.replyTo;
      if (body.isActive !== undefined) updates.is_active = body.isActive;

      if (body.isDefault === true) {
        await aliasesRepo.unsetDefaultInDomain(existing.domain_id);
        updates.is_default = true;
      } else if (body.isDefault === false) {
        updates.is_default = false;
      }

      try {
        const updated = await aliasesRepo.updateAlias(request.params.id, updates);
        return { alias: updated };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Update failed';
        if (msg.includes('uq_mailer_domain_aliases_default')) {
          return reply.status(409).send({
            error: 'DEFAULT_ALREADY_SET',
            message: 'Ya hay otro alias marcado como default en este dominio. Desactívalo primero.',
          });
        }
        throw err;
      }
    },
  );

  server.delete(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: { params: idParam, tags: ['Aliases'] },
    },
    async (request, reply) => {
      const existing = await assertAliasOwnership(request.params.id, request.userId);
      if (!existing) return reply.status(404).send({ error: 'Not Found' });

      await aliasesRepo.deleteAlias(request.params.id);
      return { deleted: true };
    },
  );
}
