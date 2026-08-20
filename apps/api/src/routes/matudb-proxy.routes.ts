import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Proxy transparente a MatuDB. La idea: el dashboard llama a
 * `https://api.matucatalogo.com/api/matudb/<resto>` y este módulo reenvía
 * la petición a `MATUDB_URL` server-to-server. Esto evita que el navegador
 * del usuario contacte directamente a `db.matudb.com` y sufra CORS.
 *
 * - Reenvía método, query, headers y body tal cual.
 * - Añade / reemplaza `apikey` con la service-role key del server.
 * - Reenvía la cabecera `Authorization` del cliente para que MatuDB aplique
 *   RLS con el JWT del usuario.
 * - Maneja el preflight (OPTIONS) sin tocar MatuDB.
 */
export async function matudbProxyRoutes(app: FastifyInstance) {
  const matudbBase = (process.env.MATUDB_URL ?? 'https://db.matudb.com').replace(/\/$/, '');
  const serviceKey = process.env.MATUDB_API_KEY;

  if (!serviceKey) {
    app.log.warn(
      '[matudb-proxy] MATUDB_API_KEY no definida — las llamadas fallarán con 401 desde MatuDB',
    );
  }

  const HOP_BY_HOP = new Set([
    'host',
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'content-length',
  ]);

  const SKIP_RESPONSE_HEADERS = new Set([
    'content-encoding',
    'transfer-encoding',
    'connection',
    'keep-alive',
  ]);

  async function handler(request: FastifyRequest, reply: FastifyReply) {
    const pathSuffix = request.url.replace(/^\/api\/matudb/, '') || '/';
    const targetUrl = `${matudbBase}${pathSuffix}`;

    const headers = new Headers();
    const incoming = request.headers;
    for (const [key, raw] of Object.entries(incoming)) {
      if (raw === undefined) continue;
      if (HOP_BY_HOP.has(key.toLowerCase())) continue;
      const value = Array.isArray(raw) ? raw.join(', ') : String(raw);
      try {
        headers.set(key, value);
      } catch {
        // Algunos valores ilegales: los ignoramos
      }
    }

    if (!headers.has('apikey') && serviceKey) {
      headers.set('apikey', serviceKey);
    }
    // Refuerzo de host de MatuDB por si el cliente lo envía
    headers.set('host', new URL(matudbBase).host);
    headers.set('x-forwarded-host', new URL(matudbBase).host);
    headers.set('x-forwarded-proto', 'https');

    const method = request.method.toUpperCase();
    const init: RequestInit = { method, headers };

    if (method !== 'GET' && method !== 'HEAD') {
      // Pasamos el cuerpo en raw (request.raw es el stream de Node).
      // Para JSON normal, fastify ya lo habrá parseado en request.body pero
      // serializar de nuevo puede alterar tipos (fechas, undefined). Por eso
      // usamos el stream crudo que conserva el payload exacto.
      const raw = (request as unknown as { raw?: { body?: unknown } }).raw;
      const rawBody = raw?.body;
      if (rawBody !== undefined && rawBody !== null) {
        if (typeof rawBody === 'string') {
          init.body = rawBody;
        } else if (Buffer.isBuffer(rawBody)) {
          init.body = new Uint8Array(rawBody);
        } else {
          init.body = JSON.stringify(rawBody);
        }
      } else if (request.body !== undefined && request.body !== null) {
        init.body = JSON.stringify(request.body);
      }
    }

    let upstream: Response;
    try {
      upstream = await fetch(targetUrl, init);
    } catch (err) {
      request.log.error({ err, targetUrl }, '[matudb-proxy] fetch failed');
      return reply.status(502).send({
        error: 'MATUDB_UPSTREAM_UNREACHABLE',
        message: err instanceof Error ? err.message : 'No se pudo contactar MatuDB',
      });
    }

    reply.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
      try {
        reply.header(key, value);
      } catch {
        // Cabecera ilegal: la saltamos
      }
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    return reply.send(buf);
  }

  // Registrar la ruta wildcard para todos los métodos (excepto OPTIONS
  // que lo maneja el plugin cors con preflight).
  app.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    url: '/api/matudb/*',
    handler,
  });
}
