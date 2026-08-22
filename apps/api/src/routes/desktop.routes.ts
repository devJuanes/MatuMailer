import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { desktopReleasesRepo } from '@matumailer/database';

const platformSchema = z.enum(['windows', 'android']);

/**
 * Releases del cliente desktop.
 * - GET /api/desktop/latest?platform=windows  → JSON (check de actualización)
 * - GET /api/desktop/download/:platform/latest → binario (requiere sesión)
 *
 * Los archivos viven en DESKTOP_RELEASES_DIR (default: <APP_DIR>/releases).
 */
export async function desktopRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();
  const releasesRoot = (
    process.env.DESKTOP_RELEASES_DIR ?? path.join(process.env.APP_DIR ?? process.cwd(), 'releases')
  ).replace(/\/$/, '');

  function resolveFile(relPath: string): string | null {
    const full = path.resolve(releasesRoot, relPath);
    if (!full.startsWith(path.resolve(releasesRoot))) return null;
    if (!existsSync(full)) return null;
    return full;
  }

  /** Check público: la app Flutter consulta al iniciar. */
  server.get(
    '/latest',
    {
      schema: {
        querystring: z.object({ platform: platformSchema.default('windows') }),
        tags: ['Desktop'],
      },
    },
    async (request) => {
      const { platform } = request.query;
      const release = await desktopReleasesRepo.findLatestRelease(platform);
      if (!release) {
        return {
          available: false,
          platform,
          release: null,
        };
      }

      const base =
        process.env.PUBLIC_API_URL?.replace(/\/$/, '') || 'https://matumailer.matubyte.com';

      return {
        available: true,
        platform,
        release: {
          version: release.version,
          buildNumber: release.build_number,
          title: release.title,
          notes: release.notes,
          mandatory: release.mandatory,
          fileName: release.file_name,
          fileSizeBytes: release.file_size_bytes,
          sha256: release.sha256,
          publishedAt: release.published_at,
          downloadUrl: release.download_url || `${base}/api/desktop/download/${platform}/latest`,
        },
      };
    },
  );

  /** Lista (dashboard, autenticado). */
  server.get(
    '/releases',
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: z.object({
          platform: platformSchema.optional(),
        }),
        tags: ['Desktop'],
      },
    },
    async (request) => {
      const releases = await desktopReleasesRepo.listReleases(request.query.platform);
      return { releases };
    },
  );

  /**
   * Descarga del latest (público: la app desktop abre esta URL al actualizar;
   * el dashboard también la usa con el botón Descargar).
   */
  server.get(
    '/download/:platform/latest',
    {
      schema: {
        params: z.object({ platform: platformSchema }),
        tags: ['Desktop'],
      },
    },
    async (request, reply) => {
      const { platform } = request.params;
      const release = await desktopReleasesRepo.findLatestRelease(platform);
      if (!release) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No hay release publicado para esta plataforma',
        });
      }

      const file = resolveFile(release.file_path);
      if (!file) {
        return reply.status(404).send({
          error: 'FILE_MISSING',
          message: 'El archivo del release no está en el servidor todavía',
        });
      }

      const stat = statSync(file);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${release.file_name}"`);
      reply.header('Content-Length', stat.size);
      return reply.send(createReadStream(file));
    },
  );
}
