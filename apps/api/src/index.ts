import './bootstrap.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './routes/auth.routes.js';
import { projectsRoutes } from './routes/projects.routes.js';
import { smtpRoutes } from './routes/smtp.routes.js';
import { templatesRoutes } from './routes/templates.routes.js';
import { emailsRoutes } from './routes/emails.routes.js';
import { billingRoutes } from './routes/billing.routes.js';
import { contactsRoutes } from './routes/contacts.routes.js';
import { brandingRoutes } from './routes/branding.routes.js';
import { trackingRoutes } from './routes/tracking.routes.js';
import { domainsRoutes } from './routes/domains.routes.js';
import { startScheduleWorker } from './services/schedule.service.js';
import { getMatuOps, reportMatuOpsError, startMatuOps, stopMatuOps } from './lib/matuops.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) => Promise<void>;
    authenticateApiToken: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) => Promise<void>;
  }
}

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

async function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'production',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: CORS_ORIGIN.split(','), credentials: true });
  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'MatuMailer API',
        description: 'Plataforma de infraestructura de correo para desarrolladores',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${PORT}`, description: 'Local' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          apiToken: { type: 'http', scheme: 'bearer', description: 'API Token (mm_live_...)' },
        },
      },
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(authPlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'matumailer-api' }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(projectsRoutes, { prefix: '/api/projects' });
  await app.register(smtpRoutes, { prefix: '/api/smtp' });
  await app.register(templatesRoutes, { prefix: '/api/templates' });
  await app.register(emailsRoutes, { prefix: '/api/emails' });
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(contactsRoutes, { prefix: '/api/contacts' });
  await app.register(brandingRoutes, { prefix: '/api/branding' });
  await app.register(domainsRoutes, { prefix: '/api/domains' });
  await app.register(trackingRoutes);

  app.setErrorHandler(async (error, request, reply) => {
    const err = error instanceof Error ? error : new Error(String(error));
    request.log.error({ err, url: request.url }, 'request error');
    await reportMatuOpsError(err, { url: request.url, method: request.method }).catch(
      () => undefined,
    );
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return reply.status(status).send({
      error: err.message || 'Internal Server Error',
      requestId: request.id,
    });
  });

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'EADDRINUSE') {
      console.error(
        `\n❌ Puerto ${PORT} en uso. Otro proceso (¿MatuDB local?) ya usa ese puerto.\n` +
          `   Cambia PORT en .env (recomendado: 4001) y NEXT_PUBLIC_API_URL en el dashboard.\n`,
      );
      process.exit(1);
    }
    throw err;
  }
  startScheduleWorker();
  const matuops = startMatuOps();
  console.log(`🚀 MatuMailer API en http://localhost:${PORT}`);
  console.log(`📚 Documentación: http://localhost:${PORT}/docs`);
  console.log(
    `⏱️  Cola de envíos programados activa (cada ${process.env.SCHEDULER_INTERVAL_MS ?? 30000}ms)`,
  );
  console.log(
    matuops
      ? '✅ MatuOps: monitoreo activo (heartbeat + logs + errores)'
      : '⚠️  MatuOps: sin token — define MATUOPS_APP_TOKEN en .env',
  );
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    getMatuOps()
      ?.reportLog(`MatuMailer API deteniéndose (${signal})`, 'warning', { component: 'api' })
      .catch(() => undefined);
    stopMatuOps();
    process.exit(0);
  });
}

main().catch(async (err) => {
  console.error(err);
  await reportMatuOpsError(err instanceof Error ? err : { message: String(err) }, {
    phase: 'startup',
  }).catch(() => undefined);
  process.exit(1);
});
