import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { aliasesRepo, projectsRepo } from '@matumailer/database';
import { z } from 'zod';

/**
 * Sending identities = aliases listos para enviar (dominio verificado + alias activo).
 * La API key del proyecto nunca ve identidades de otro proyecto.
 */
async function resolveAuthorizedProject(
  request: { projectId?: string; userId?: string },
  queryProjectId?: string,
): Promise<
  | { ok: true; project: NonNullable<Awaited<ReturnType<typeof projectsRepo.findProjectById>>> }
  | { ok: false; status: number; payload: Record<string, unknown> }
> {
  let projectId = request.projectId ?? queryProjectId ?? null;
  if (!projectId && request.userId) {
    const projects = await projectsRepo.findProjectsByUserId(request.userId);
    if (projects.length === 1) projectId = projects[0].id;
  }
  if (!projectId) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: 'PROJECT_REQUIRED',
        message: 'Pasa projectId o usa un token mm_live_ del proyecto.',
      },
    };
  }

  const project = await projectsRepo.findProjectById(projectId);
  if (!project) {
    return { ok: false, status: 404, payload: { error: 'Not Found' } };
  }
  if (request.userId && project.user_id !== request.userId) {
    return { ok: false, status: 404, payload: { error: 'Not Found' } };
  }
  if (request.projectId && request.projectId !== projectId) {
    return {
      ok: false,
      status: 403,
      payload: {
        error: 'SENDING_IDENTITY_NOT_ALLOWED',
        message: 'La API key no puede listar identidades de otro proyecto.',
      },
    };
  }
  return { ok: true, project };
}

function toIdentity(
  a: {
    id: string;
    full_email: string;
    local_part: string;
    domain: string;
    domain_id: string;
    display_name: string | null;
    is_default: boolean;
  },
  defaultAliasId: string | null | undefined,
) {
  return {
    id: a.id,
    email: a.full_email,
    alias: a.local_part,
    domain: a.domain,
    domainId: a.domain_id,
    displayName: a.display_name,
    isDefault: a.is_default || a.id === defaultAliasId,
    status: 'ready' as const,
  };
}

export async function sendingIdentitiesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        querystring: z.object({ projectId: z.string().uuid().optional() }),
        tags: ['Sending identities'],
      },
    },
    async (request, reply) => {
      const resolved = await resolveAuthorizedProject(request, request.query.projectId);
      if (!resolved.ok) {
        return reply.status(resolved.status).send(resolved.payload);
      }
      const { project } = resolved;

      const aliases = await aliasesRepo.listSendableAliases(project.id);
      const identities = aliases.map((a) => toIdentity(a, project.default_alias_id));

      return {
        identities,
        defaultSendingIdentityId:
          project.default_alias_id ?? identities.find((i) => i.isDefault)?.id ?? null,
      };
    },
  );

  server.get(
    '/:id',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({ projectId: z.string().uuid().optional() }),
        tags: ['Sending identities'],
      },
    },
    async (request, reply) => {
      const resolved = await resolveAuthorizedProject(request, request.query.projectId);
      if (!resolved.ok) {
        return reply.status(resolved.status).send(resolved.payload);
      }
      const { project } = resolved;

      const found = await aliasesRepo.findAliasById(request.params.id);
      if (!found || found.projectId !== project.id) {
        return reply.status(404).send({
          error: 'SENDING_IDENTITY_NOT_FOUND',
          message: 'Esa identidad de envío no existe en este proyecto.',
        });
      }

      const sendable = await aliasesRepo.listSendableAliases(project.id);
      const row = sendable.find((a) => a.id === request.params.id);
      if (!row) {
        return reply.status(400).send({
          error: 'SENDING_IDENTITY_NOT_VERIFIED',
          message:
            'Ese alias no está listo para enviar. Verifica el dominio por DNS y activa el alias.',
        });
      }

      return {
        identity: toIdentity(row, project.default_alias_id),
      };
    },
  );
}
