import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createDomainSchema,
  updateDomainSchema,
  buildDomainDnsRecordList,
  buildMxRecords,
  generateDkimKeyPair,
  isStaleMatumailerDnsValue,
  returnPathHost,
  returnPathTarget,
  MATUMAILER_MAIL_HOST,
  MATUMAILER_RELAY_IP,
} from '@matumailer/shared';
import { domainsRepo, projectsRepo } from '@matumailer/database';
import { z } from 'zod';
import { encrypt } from '../lib/crypto.js';
import { checkDomainDns } from '../lib/domain-dns.js';
import {
  domainStatusFromSummary,
  recordStatusFromCheck,
  summarizeVerification,
} from '../lib/domain-verification.js';
import {
  assertCanCreateDomain,
  isPlanLimitError,
  planLimitReply,
} from '../services/plan.service.js';
import { schedulePostfixInboundSync } from '../services/postfix-inbound-sync.js';

const RETURN_PATH_PREFIX = 'rp';

function randomReturnPathSubdomain(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${RETURN_PATH_PREFIX}-${rand}`;
}

function ensureProjectAccess(
  project: { user_id: string } | null,
  userId: string | undefined,
): project is { user_id: string } {
  return !!project && !!userId && project.user_id === userId;
}

async function regenerateDnsForDomain(domain: {
  id: string;
  domain: string;
  region: string;
  dkim_selector: string;
  dkim_public_key: string;
  return_path_subdomain: string;
}) {
  const records = buildDomainDnsRecordList({
    domain: domain.domain,
    region: domain.region,
    dkimSelector: domain.dkim_selector,
    dkimPublicKey: domain.dkim_public_key,
    returnPathSubdomain: domain.return_path_subdomain,
  });
  await domainsRepo.replaceDnsRecords(domain.id, records);
  await domainsRepo.updateDomainStatus(domain.id, 'pending', false);
  return domainsRepo.findDomainWithRecords(domain.id);
}

export async function domainsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    '/',
    {
      preHandler: [app.authenticateApiToken],
      schema: {
        querystring: z.object({ projectId: z.string().uuid().optional() }),
        tags: ['Domains'],
      },
    },
    async (request, reply) => {
      const projectId = request.projectId ?? request.query.projectId;
      if (!projectId) {
        return reply.status(400).send({ error: 'PROJECT_REQUIRED' });
      }
      if (
        request.projectId &&
        request.query.projectId &&
        request.projectId !== request.query.projectId
      ) {
        return reply.status(403).send({ error: 'DOMAIN_NOT_ALLOWED_FOR_PROJECT' });
      }
      const project = await projectsRepo.findProjectById(projectId);
      if (!project) return reply.status(404).send({ error: 'Not Found' });
      if (request.userId && !ensureProjectAccess(project, request.userId)) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const domains = await domainsRepo.listDomainsByProject(project.id);
      return { domains };
    },
  );

  server.post(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: z.object({ projectId: z.string().uuid() }),
        body: createDomainSchema,
        tags: ['Domains'],
      },
    },
    async (request, reply) => {
      const project = await projectsRepo.findProjectById(request.query.projectId);
      if (!ensureProjectAccess(project, request.userId!)) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      try {
        await assertCanCreateDomain(request.userId!);
      } catch (err) {
        if (isPlanLimitError(err)) {
          return reply.status(402).send(planLimitReply(err));
        }
        throw err;
      }

      const existing = await domainsRepo.findDomainByDomain(project.id, request.body.domain);
      if (existing) {
        return reply.status(409).send({
          error: 'DOMAIN_EXISTS',
          message: 'Este dominio ya está añadido a este proyecto.',
          domain: existing,
        });
      }

      const keyPair = generateDkimKeyPair();
      const returnPathSubdomain = randomReturnPathSubdomain();
      const records = buildDomainDnsRecordList({
        domain: request.body.domain,
        region: request.body.region,
        dkimSelector: keyPair.selector,
        dkimPublicKey: keyPair.publicKey,
        returnPathSubdomain,
      });

      const encryptedPrivateKey = encrypt(keyPair.privateKeyPem);

      const created = await domainsRepo.createDomain({
        project_id: project.id,
        domain: request.body.domain,
        region: request.body.region,
        dkim_selector: keyPair.selector,
        dkim_public_key: keyPair.publicKey,
        dkim_private_key_encrypted: encryptedPrivateKey,
        return_path_subdomain: returnPathSubdomain,
        records,
      });

      const { dkim_private_key_encrypted: _dkimPrivate, ...publicDomain } = created;
      return reply.status(201).send({
        domain: publicDomain,
        message: `Publica estos DNS. El MX debe apuntar a ${MATUMAILER_MAIL_HOST} (prioridad 10).`,
      });
    },
  );

  server.get(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['Domains'] },
    },
    async (request, reply) => {
      const domain = await domainsRepo.findDomainWithRecords(request.params.id);
      if (!domain) return reply.status(404).send({ error: 'Not Found' });

      const project = await projectsRepo.findProjectById(domain.project_id);
      if (!ensureProjectAccess(project, request.userId!)) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const { dkim_private_key_encrypted: _dkimPrivate, ...publicDomain } = domain;
      return { domain: publicDomain };
    },
  );

  server.patch(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateDomainSchema,
        tags: ['Domains'],
      },
    },
    async (request, reply) => {
      const domain = await domainsRepo.findDomainById(request.params.id);
      if (!domain) return reply.status(404).send({ error: 'Not Found' });
      const project = await projectsRepo.findProjectById(domain.project_id);
      if (!ensureProjectAccess(project, request.userId!)) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      if (request.body.region && request.body.region !== domain.region) {
        await domainsRepo.updateDomainStatus(
          domain.id,
          domain.status === 'verified' ? 'verifying' : domain.status,
        );
      }

      const updated = await domainsRepo.findDomainWithRecords(domain.id);
      const { dkim_private_key_encrypted: _dkimPrivate, ...publicDomain } = updated!;
      return { domain: publicDomain };
    },
  );

  server.delete(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['Domains'] },
    },
    async (request, reply) => {
      const domain = await domainsRepo.findDomainById(request.params.id);
      if (!domain) return reply.status(404).send({ error: 'Not Found' });
      const project = await projectsRepo.findProjectById(domain.project_id);
      if (!ensureProjectAccess(project, request.userId!)) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      await domainsRepo.deleteDomain(domain.id);
      return { deleted: true };
    },
  );

  /** Regenera los registros DNS (corrige hosts muertos matumailer.com → matubyte.com). */
  server.post(
    '/:id/refresh-dns',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['Domains'] },
    },
    async (request, reply) => {
      const domain = await domainsRepo.findDomainById(request.params.id);
      if (!domain) return reply.status(404).send({ error: 'Not Found' });
      const project = await projectsRepo.findProjectById(domain.project_id);
      if (!ensureProjectAccess(project, request.userId!)) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const fresh = await regenerateDnsForDomain(domain);
      const { dkim_private_key_encrypted: _dkimPrivate, ...publicDomain } = fresh!;
      return {
        domain: publicDomain,
        refreshed: true,
        message: `Registros actualizados. Borra los DNS viejos (mx.*, feedback.*, _spf.matumailer.com) y publica estos. MX → ${MATUMAILER_MAIL_HOST}`,
      };
    },
  );

  server.post(
    '/:id/verify',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['Domains'] },
    },
    async (request, reply) => {
      let domain = await domainsRepo.findDomainById(request.params.id);
      if (!domain) return reply.status(404).send({ error: 'Not Found' });
      const project = await projectsRepo.findProjectById(domain.project_id);
      if (!ensureProjectAccess(project, request.userId!)) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      let records = await domainsRepo.listRecordsByDomain(domain.id);
      const stale = records.some(
        (r) => isStaleMatumailerDnsValue(r.value) || isStaleMatumailerDnsValue(r.host),
      );
      let autoRefreshed = false;
      if (stale) {
        const refreshed = await regenerateDnsForDomain(domain);
        domain = refreshed!;
        records = refreshed!.records;
        autoRefreshed = true;
      }

      await domainsRepo.updateDomainStatus(domain.id, 'verifying');

      const mxRecords = buildMxRecords({ region: domain.region });
      const primaryMx = mxRecords[0];
      const mxHost = primaryMx?.host === '@' ? domain.domain : (primaryMx?.host ?? domain.domain);
      const mxTarget = primaryMx?.value ?? MATUMAILER_MAIL_HOST;

      const checks = await checkDomainDns({
        domain: domain.domain,
        dkimSelector: domain.dkim_selector,
        dkimPublicKey: domain.dkim_public_key,
        mailHost: MATUMAILER_MAIL_HOST,
        relayIp: MATUMAILER_RELAY_IP,
        mxHost,
        mxTarget,
        mxPriority: primaryMx?.priority ?? 10,
        returnPathHost: returnPathHost(domain.return_path_subdomain, domain.domain),
        returnPathTarget: returnPathTarget(domain.region),
      });

      const updated: typeof records = [];

      for (const record of records) {
        const match = checks.find(
          (c) => c.host.toLowerCase() === record.host.toLowerCase() && c.type === record.type,
        );
        const status = recordStatusFromCheck(match);
        await domainsRepo.updateRecordStatus(record.id, status, match?.actual ?? null);
        updated.push({
          ...record,
          status,
          last_value: match?.actual ?? null,
        });
      }

      const summary = summarizeVerification(checks, updated);
      const newStatus = domainStatusFromSummary(summary);
      await domainsRepo.updateDomainStatus(domain.id, newStatus, summary.sendingReady);
      if (summary.sendingReady) schedulePostfixInboundSync('domain-verified');

      const fresh = await domainsRepo.findDomainWithRecords(domain.id);
      const { dkim_private_key_encrypted: _dkimPrivate, ...publicDomain } = fresh!;
      const missing = checks
        .filter((c) => !c.found || c.status === 'failed')
        .map((c) => ({
          type: c.type,
          host: c.host,
          purpose: c.purpose,
          reason: c.reason ?? 'not_found',
          detected: c.detected,
        }));

      let message = summary.message;
      if (autoRefreshed && !summary.sendingReady) {
        message = `Registros regenerados (hosts viejos corregidos). ${summary.message}`;
      }

      return {
        domain: publicDomain,
        verified: summary.sendingReady,
        fullyVerified: summary.fullyVerified,
        capabilities: summary.capabilities,
        warnings: summary.warnings,
        missing,
        checks: checks.map((c) => ({
          type: c.type,
          host: c.host,
          purpose: c.purpose,
          expected: c.expected,
          found: c.found,
          status: c.status,
          actual: c.actual,
          detected: c.detected,
          reason: c.reason,
        })),
        autoRefreshed,
        message,
      };
    },
  );

  server.post(
    '/:id/default',
    {
      preHandler: [app.authenticate],
      schema: { params: z.object({ id: z.string().uuid() }), tags: ['Domains'] },
    },
    async (request, reply) => {
      const domain = await domainsRepo.findDomainById(request.params.id);
      if (!domain) return reply.status(404).send({ error: 'Not Found' });
      const project = await projectsRepo.findProjectById(domain.project_id);
      if (!ensureProjectAccess(project, request.userId!)) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      if (domain.status !== 'verified') {
        return reply.status(400).send({
          error: 'DOMAIN_NOT_VERIFIED',
          message: 'Solo puedes marcar como default un dominio verificado.',
        });
      }
      await domainsRepo.setProjectDefaultDomain(project.id, domain.id);
      return { domain: domain.id, isDefault: true };
    },
  );
}
