import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { aliasesRepo, inboundMessagesRepo, projectsRepo } from '@matumailer/database';
import { htmlToPlainText } from '@matumailer/shared';

const inboundBodySchema = z.object({
  to: z.string().email(),
  from: z.string().min(3),
  fromName: z.string().max(255).optional(),
  subject: z.string().max(500).optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  messageId: z.string().max(255).optional(),
  projectId: z.string().uuid().optional(),
  headers: z.record(z.string()).optional(),
});

function parseFrom(raw: string): { email: string; name: string | null } {
  const match = raw.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/"/g, '').trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }
  return { email: raw.trim().toLowerCase(), name: null };
}

/** Solo pistas claras de marketing → pestaña Promotions. Todo llega a folder=inbox. */
function categorize(subject: string, fromEmail: string): string {
  const s = `${subject} ${fromEmail}`.toLowerCase();
  if (/\b(unsubscribe|% off|black friday|cyber monday|promo code|cup[oó]n)\b/.test(s)) {
    return 'promotions';
  }
  if (/\b(linkedin\.com|facebookmail|instagram\.com)\b/.test(s)) {
    return 'socials';
  }
  return 'primary';
}

export async function inboundRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Ingesta de correo entrante (Postfix pipe / webhook interno).
   * Auth: Bearer INBOUND_WEBHOOK_SECRET o token de API del proyecto.
   */
  server.post(
    '/ingest',
    {
      schema: { body: inboundBodySchema, tags: ['Inbound'] },
    },
    async (request, reply) => {
      const secret = process.env.INBOUND_WEBHOOK_SECRET;
      const auth = request.headers.authorization ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

      let authorized = false;
      if (secret && token && token === secret) {
        authorized = true;
      } else if (token.startsWith('mm_live_') || token.startsWith('mm_test_')) {
        await app.authenticateApiToken(request, reply);
        if (reply.sent) return;
        authorized = true;
      }
      if (!authorized) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Usa INBOUND_WEBHOOK_SECRET o un token mm_live_ del proyecto.',
        });
      }

      const body = request.body;
      const parsedFrom = parseFrom(body.from);
      const toEmail = body.to.toLowerCase().trim();

      const aliasRow = await aliasesRepo.findAliasRowByEmail(toEmail);
      if (!aliasRow) {
        return reply.status(404).send({
          error: 'ALIAS_NOT_FOUND',
          message: `No hay alias ${toEmail} en MatuMailer.`,
        });
      }
      if (!aliasRow.alias.is_active) {
        return reply.status(404).send({
          error: 'ALIAS_INACTIVE',
          message: `El alias ${toEmail} está desactivado.`,
        });
      }
      if (aliasRow.domain.status !== 'verified') {
        return reply.status(404).send({
          error: 'DOMAIN_NOT_VERIFIED',
          message: `El dominio de ${toEmail} no está verificado.`,
        });
      }

      const projectId = aliasRow.domain.project_id;
      if (request.projectId && request.projectId !== projectId) {
        return reply.status(403).send({ error: 'PROJECT_MISMATCH' });
      }
      if (body.projectId && body.projectId !== projectId) {
        return reply.status(403).send({ error: 'PROJECT_MISMATCH' });
      }

      const html = body.html?.trim() || null;
      const text = body.text?.trim() || (html ? htmlToPlainText(html) : '') || '';
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 180);
      const subject = body.subject?.trim() || '(sin asunto)';

      const message = await inboundMessagesRepo.create({
        project_id: projectId,
        domain_id: aliasRow.domain.id,
        alias_id: aliasRow.alias.id,
        message_id: body.messageId ?? null,
        from_email: parsedFrom.email,
        from_name: body.fromName ?? parsedFrom.name,
        to_email: toEmail,
        subject,
        preview,
        text_body: text || null,
        html_body: html,
        category: categorize(subject, parsedFrom.email),
        folder: 'inbox',
        raw_headers: body.headers ?? null,
      });

      return reply.status(201).send({ success: true, message });
    },
  );

  server.get(
    '/',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        querystring: z.object({
          projectId: z.string().uuid().optional(),
          folder: z.string().optional(),
          to: z.string().email().optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        }),
        tags: ['Inbound'],
      },
    },
    async (request, reply) => {
      let projectId = request.projectId ?? request.query.projectId ?? null;
      if (!projectId && request.userId) {
        const projects = await projectsRepo.findProjectsByUserId(request.userId);
        if (projects.length === 1) projectId = projects[0].id;
      }
      if (!projectId) {
        return reply.status(400).send({ error: 'PROJECT_REQUIRED' });
      }

      const project = await projectsRepo.findProjectById(projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      if (request.userId && project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      if (request.projectId && request.projectId !== projectId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const messages = await inboundMessagesRepo.listByProject(projectId, {
        folder: request.query.folder,
        toEmail: request.query.to,
        limit: request.query.limit,
      });
      return { messages };
    },
  );

  server.patch(
    '/:id',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          folder: z.string().optional(),
          starred: z.boolean().optional(),
          pinned: z.boolean().optional(),
          unread: z.boolean().optional(),
          category: z.string().optional(),
        }),
        tags: ['Inbound'],
      },
    },
    async (request, reply) => {
      const existing = await inboundMessagesRepo.findById(request.params.id);
      if (!existing) return reply.status(404).send({ error: 'Not Found' });

      const project = await projectsRepo.findProjectById(existing.project_id);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      if (request.userId && project.user_id !== request.userId) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      if (request.projectId && request.projectId !== existing.project_id) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const message = await inboundMessagesRepo.updateFlags(existing.id, request.body);
      return { message };
    },
  );
}
