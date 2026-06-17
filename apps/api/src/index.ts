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
import { startScheduleWorker } from './services/schedule.service.js';

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
  console.log(`🚀 MatuMailer API en http://localhost:${PORT}`);
  console.log(`📚 Documentación: http://localhost:${PORT}/docs`);
  console.log(
    `⏱️  Cola de envíos programados activa (cada ${process.env.SCHEDULER_INTERVAL_MS ?? 30000}ms)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
