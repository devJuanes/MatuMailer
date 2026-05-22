import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { MatuAuthError, matuGetUserFromToken } from '@matumailer/database';
import { hashToken } from '../lib/crypto.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    projectId?: string;
    matuAuthEmail?: string;
  }
}

function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const token = extractBearerToken(request);
      if (!token) {
        return reply.status(401).send({
          error: 'No autorizado',
          message: 'Token de sesión no proporcionado',
        });
      }

      try {
        const authUser = await matuGetUserFromToken(token);
        request.userId = authUser.id;
        request.matuAuthEmail = authUser.email;
      } catch (err) {
        const message =
          err instanceof MatuAuthError
            ? err.message
            : 'Token inválido o expirado';
        return reply.status(401).send({ error: 'No autorizado', message });
      }
    },
  );

  fastify.decorate(
    'authenticateApiToken',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'No autorizado',
          message: 'Falta el token de API',
        });
      }

      const token = authHeader.slice(7);

      if (token.startsWith('mm_live_') || token.startsWith('mm_test_')) {
        const { apiTokensRepo } = await import('@matumailer/database');
        const tokenHash = hashToken(token);
        const record = await apiTokensRepo.findTokenByHash(tokenHash);

        if (!record) {
          return reply.status(401).send({
            error: 'No autorizado',
            message: 'Token de API inválido',
          });
        }

        if (record.expires_at && new Date(record.expires_at) < new Date()) {
          return reply.status(401).send({
            error: 'No autorizado',
            message: 'Token de API expirado',
          });
        }

        request.projectId = record.project_id;
        await apiTokensRepo.updateTokenLastUsed(record.id);
        return;
      }

      try {
        const authUser = await matuGetUserFromToken(token);
        request.userId = authUser.id;
        request.matuAuthEmail = authUser.email;
      } catch {
        return reply.status(401).send({
          error: 'No autorizado',
          message: 'Token inválido',
        });
      }
    },
  );
}

export default fp(authPlugin);
