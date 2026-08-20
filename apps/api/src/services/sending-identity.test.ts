import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Domain, DomainAlias, DomainAliasWithDomain } from '@matumailer/shared';
import {
  resolveSendingIdentityWithStore,
  type SendingIdentityStore,
} from './sending-identity.js';
import { SendingIdentityError } from '../lib/sending-errors.js';

function domain(overrides: Partial<Domain> & Pick<Domain, 'id' | 'project_id' | 'domain'>): Domain {
  return {
    region: 'us-east-1',
    status: 'verified',
    dkim_selector: 'mm',
    dkim_public_key: 'pub',
    dkim_private_key_encrypted: 'enc',
    return_path_subdomain: 'rp',
    last_check_at: null,
    last_verified_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function alias(
  overrides: Partial<DomainAlias> & Pick<DomainAlias, 'id' | 'domain_id' | 'full_email'>,
): DomainAlias {
  const local = overrides.local_part ?? overrides.full_email.split('@')[0];
  return {
    local_part: local,
    display_name: null,
    reply_to: null,
    is_active: true,
    is_default: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function withDomain(a: DomainAlias, d: Domain): DomainAliasWithDomain {
  return { ...a, domain: d.domain };
}

function store(opts: {
  projectId: string;
  defaultAliasId?: string | null;
  domains: Domain[];
  aliases: DomainAlias[];
}): SendingIdentityStore {
  const aliases = opts.aliases;
  const domains = opts.domains;
  const domainById = new Map(domains.map((d) => [d.id, d]));

  return {
    async findProject(projectId) {
      if (projectId !== opts.projectId) return null;
      return { id: projectId, default_alias_id: opts.defaultAliasId ?? null };
    },
    async findAliasById(aliasId) {
      const a = aliases.find((x) => x.id === aliasId);
      if (!a) return null;
      const d = domainById.get(a.domain_id);
      if (!d) return null;
      return { alias: a, projectId: d.project_id, domain: d };
    },
    async findAliasByFullEmail(fullEmail) {
      const a = aliases.find((x) => x.full_email.toLowerCase() === fullEmail.toLowerCase());
      if (!a) return null;
      const d = domainById.get(a.domain_id);
      if (!d) return null;
      return { alias: a, domain: d };
    },
    async findDomainById(id) {
      return domainById.get(id) ?? null;
    },
    async listSendableAliases(projectId, domainId) {
      return aliases
        .filter((a) => {
          const d = domainById.get(a.domain_id);
          if (!d || d.project_id !== projectId || d.status !== 'verified' || !a.is_active) {
            return false;
          }
          if (domainId && a.domain_id !== domainId) return false;
          return true;
        })
        .map((a) => withDomain(a, domainById.get(a.domain_id)!));
    },
    async listDomainsByProject(projectId) {
      return domains.filter((d) => d.project_id === projectId);
    },
  };
}

const projectA = '11111111-1111-1111-1111-111111111111';
const projectB = '22222222-2222-2222-2222-222222222222';

const domainA = domain({
  id: 'da',
  project_id: projectA,
  domain: 'example.com',
});
const domainAPending = domain({
  id: 'dap',
  project_id: projectA,
  domain: 'pending.com',
  status: 'pending',
});
const domainB = domain({
  id: 'db',
  project_id: projectB,
  domain: 'other.com',
});

const sales = alias({
  id: 'alias-sales',
  domain_id: 'da',
  full_email: 'ventas@example.com',
  local_part: 'ventas',
});
const support = alias({
  id: 'alias-support',
  domain_id: 'da',
  full_email: 'soporte@example.com',
  local_part: 'soporte',
  is_default: true,
});
const disabled = alias({
  id: 'alias-off',
  domain_id: 'da',
  full_email: 'off@example.com',
  is_active: false,
});
const other = alias({
  id: 'alias-b',
  domain_id: 'db',
  full_email: 'hola@other.com',
});

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (err: unknown) => {
    assert.ok(err instanceof SendingIdentityError);
    assert.equal(err.code, code);
    return true;
  });
}

describe('resolveSendingIdentity', () => {
  it('verified domain + alias is allowed', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({ projectId: projectA, domains: [domainA], aliases: [sales] }),
      { projectId: projectA, from: 'ventas@example.com' },
    );
    assert.equal(resolved.fromEmail, 'ventas@example.com');
    assert.equal(resolved.aliasId, 'alias-sales');
  });

  it('unverified domain is rejected', async () => {
    const pendingAlias = alias({
      id: 'p1',
      domain_id: 'dap',
      full_email: 'a@pending.com',
    });
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({
            projectId: projectA,
            domains: [domainAPending],
            aliases: [pendingAlias],
          }),
          { projectId: projectA, from: 'a@pending.com' },
        ),
      'DOMAIN_NOT_VERIFIED',
    );
  });

  it('unknown alias is rejected', async () => {
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({ projectId: projectA, domains: [domainA], aliases: [sales] }),
          { projectId: projectA, from: 'nobody@example.com' },
        ),
      'SENDING_IDENTITY_NOT_FOUND',
    );
  });

  it('alias from another project is rejected', async () => {
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({
            projectId: projectA,
            domains: [domainA, domainB],
            aliases: [sales, other],
          }),
          { projectId: projectA, from: 'hola@other.com' },
        ),
      'SENDING_IDENTITY_NOT_ALLOWED',
    );
  });

  it('one alias becomes automatic sender', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({ projectId: projectA, domains: [domainA], aliases: [sales] }),
      { projectId: projectA },
    );
    assert.equal(resolved.fromEmail, 'ventas@example.com');
  });

  it('multiple aliases + default uses default', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({
        projectId: projectA,
        domains: [domainA],
        aliases: [sales, support],
      }),
      { projectId: projectA },
    );
    assert.equal(resolved.fromEmail, 'soporte@example.com');
  });

  it('multiple aliases without default errors', async () => {
    const marketing = alias({
      id: 'm',
      domain_id: 'da',
      full_email: 'mkt@example.com',
    });
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({
            projectId: projectA,
            domains: [domainA],
            aliases: [sales, marketing],
          }),
          { projectId: projectA },
        ),
      'NO_DEFAULT_SENDING_IDENTITY',
    );
  });

  it('explicit from selects that sender', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({
        projectId: projectA,
        defaultAliasId: 'alias-support',
        domains: [domainA],
        aliases: [sales, support],
      }),
      { projectId: projectA, from: 'ventas@example.com' },
    );
    assert.equal(resolved.fromEmail, 'ventas@example.com');
  });

  it('project default_alias_id is used when present', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({
        projectId: projectA,
        defaultAliasId: 'alias-sales',
        domains: [domainA],
        aliases: [
          sales,
          { ...support, is_default: false },
        ],
      }),
      { projectId: projectA },
    );
    assert.equal(resolved.fromEmail, 'ventas@example.com');
  });

  it('disabled alias is rejected', async () => {
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({ projectId: projectA, domains: [domainA], aliases: [disabled] }),
          { projectId: projectA, from: 'off@example.com' },
        ),
      'SENDING_IDENTITY_DISABLED',
    );
  });

  it('project A cannot send with aliasId from project B', async () => {
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({
            projectId: projectA,
            domains: [domainA, domainB],
            aliases: [sales, other],
          }),
          { projectId: projectA, aliasId: 'alias-b' },
        ),
      'SENDING_IDENTITY_NOT_ALLOWED',
    );
  });

  it('domainId with one alias uses that alias', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({ projectId: projectA, domains: [domainA], aliases: [sales] }),
      { projectId: projectA, domainId: 'da' },
    );
    assert.equal(resolved.fromEmail, 'ventas@example.com');
  });

  it('domainId with default alias uses default', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({
        projectId: projectA,
        domains: [domainA],
        aliases: [sales, support],
      }),
      { projectId: projectA, domainId: 'da' },
    );
    assert.equal(resolved.fromEmail, 'soporte@example.com');
  });

  it('domainId with multiple aliases and no default errors', async () => {
    const marketing = alias({
      id: 'm',
      domain_id: 'da',
      full_email: 'mkt@example.com',
    });
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({
            projectId: projectA,
            domains: [domainA],
            aliases: [sales, marketing],
          }),
          { projectId: projectA, domainId: 'da' },
        ),
      'NO_DEFAULT_SENDING_IDENTITY',
    );
  });

  it('domainId for another project is rejected', async () => {
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({
            projectId: projectA,
            domains: [domainA, domainB],
            aliases: [sales, other],
          }),
          { projectId: projectA, domainId: 'db' },
        ),
      'DOMAIN_NOT_ALLOWED_FOR_PROJECT',
    );
  });

  it('unknown domainId is rejected', async () => {
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({ projectId: projectA, domains: [domainA], aliases: [sales] }),
          { projectId: projectA, domainId: 'missing' },
        ),
      'DOMAIN_NOT_FOUND',
    );
  });

  it('project without verified domains errors', async () => {
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({ projectId: projectA, domains: [domainAPending], aliases: [] }),
          { projectId: projectA },
        ),
      'NO_VERIFIED_DOMAIN',
    );
  });

  it('verified domain without aliases errors', async () => {
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({ projectId: projectA, domains: [domainA], aliases: [] }),
          { projectId: projectA },
        ),
      'NO_ALIAS_ON_DOMAIN',
    );
  });

  it('parses from with display name angle brackets', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({ projectId: projectA, domains: [domainA], aliases: [sales] }),
      { projectId: projectA, from: 'Ventas <ventas@example.com>' },
    );
    assert.equal(resolved.fromEmail, 'ventas@example.com');
  });

  it('invalid project default_alias_id falls back to unique sendable', async () => {
    const resolved = await resolveSendingIdentityWithStore(
      store({
        projectId: projectA,
        defaultAliasId: 'alias-off',
        domains: [domainA],
        aliases: [sales, disabled],
      }),
      { projectId: projectA },
    );
    assert.equal(resolved.fromEmail, 'ventas@example.com');
  });

  it('disabled project default with multiple aliases errors', async () => {
    const marketing = alias({
      id: 'm',
      domain_id: 'da',
      full_email: 'mkt@example.com',
    });
    await expectCode(
      () =>
        resolveSendingIdentityWithStore(
          store({
            projectId: projectA,
            defaultAliasId: 'alias-off',
            domains: [domainA],
            aliases: [sales, marketing, disabled],
          }),
          { projectId: projectA },
        ),
      'NO_DEFAULT_SENDING_IDENTITY',
    );
  });
});
