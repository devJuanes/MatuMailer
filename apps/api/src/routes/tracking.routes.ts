import type { FastifyInstance } from 'fastify';
import { emailEventsRepo } from '@matumailer/database';

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function trackingRoutes(app: FastifyInstance) {
  app.get('/t/o/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    try {
      const log = await emailEventsRepo.findLogByTrackingToken(token);
      if (log) {
        await emailEventsRepo.create({
          email_log_id: log.id,
          project_id: log.project_id,
          type: 'open',
          user_agent: request.headers['user-agent'] ?? null,
        });
      }
    } catch {
      // never fail tracking pixel
    }
    return reply
      .header('Content-Type', 'image/gif')
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      .send(PIXEL);
  });

  app.get('/t/c/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const query = request.query as { u?: string };
    const target = query.u || '/';
    try {
      const log = await emailEventsRepo.findLogByTrackingToken(token);
      if (log) {
        await emailEventsRepo.create({
          email_log_id: log.id,
          project_id: log.project_id,
          type: 'click',
          url: target,
          user_agent: request.headers['user-agent'] ?? null,
        });
      }
    } catch {
      // ignore
    }
    if (/^https?:\/\//i.test(target)) {
      return reply.redirect(target);
    }
    return reply.redirect('/');
  });
}
