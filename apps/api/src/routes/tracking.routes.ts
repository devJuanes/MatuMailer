import type { FastifyInstance } from 'fastify';
import { contactsRepo, emailEventsRepo } from '@matumailer/database';

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function recordUnsubscribe(token: string, userAgent?: string | null) {
  const log = await emailEventsRepo.findLogByTrackingToken(token);
  if (!log) return null;

  await emailEventsRepo.create({
    email_log_id: log.id,
    project_id: log.project_id,
    type: 'unsubscribe',
    user_agent: userAgent ?? null,
  });

  const toEmail = (log as { to_email?: string }).to_email;
  if (toEmail) {
    const contact = await contactsRepo.findByEmail(log.project_id, toEmail);
    if (contact && !contact.unsubscribed_at) {
      await contactsRepo.markUnsubscribed(contact.id);
    }
  }
  return log;
}

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

  // One-click / manual unsubscribe (RFC 8058 + List-Unsubscribe HTTPS).
  app.get('/t/u/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    try {
      await recordUnsubscribe(token, request.headers['user-agent'] ?? null);
    } catch {
      // still show confirmation
    }
    return reply
      .type('text/html; charset=utf-8')
      .send(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Suscripción cancelada</title></head><body style="font-family:sans-serif;max-width:480px;margin:48px auto;padding:0 16px"><h1 style="font-size:1.25rem">Suscripción cancelada</h1><p>Ya no recibirás más correos de esta lista.</p></body></html>`,
      );
  });

  app.post('/t/u/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    try {
      await recordUnsubscribe(token, request.headers['user-agent'] ?? null);
    } catch {
      // ignore
    }
    return reply.status(200).send('OK');
  });
}
