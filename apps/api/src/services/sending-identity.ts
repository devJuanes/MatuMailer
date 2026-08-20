import type { Domain, DomainAlias, DomainAliasWithDomain } from '@matumailer/shared';
import { aliasesRepo, domainsRepo, projectsRepo } from '@matumailer/database';
import { parseFromEmail, SendingIdentityError } from '../lib/sending-errors.js';

export interface ResolvedSendingIdentity {
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  domain: Domain;
  aliasId: string;
  alias: DomainAlias;
}

export interface ResolveSendingIdentityInput {
  projectId: string;
  from?: string;
  fromName?: string;
  domainId?: string;
  aliasId?: string;
}

export interface SendingIdentityStore {
  findProject(projectId: string): Promise<{
    id: string;
    default_alias_id?: string | null;
    default_domain_id?: string | null;
  } | null>;
  findAliasById(aliasId: string): Promise<{
    alias: DomainAlias;
    projectId: string;
    domain: Domain;
  } | null>;
  findAliasByFullEmail(fullEmail: string): Promise<{
    alias: DomainAlias;
    domain: Domain;
  } | null>;
  findDomainById(domainId: string): Promise<Domain | null>;
  listSendableAliases(projectId: string, domainId?: string): Promise<DomainAliasWithDomain[]>;
  listDomainsByProject(projectId: string): Promise<Domain[]>;
}

function toResolved(
  alias: DomainAlias,
  domain: Domain,
  fromName?: string,
): ResolvedSendingIdentity {
  return {
    fromEmail: alias.full_email,
    fromName: fromName ?? alias.display_name,
    replyTo: alias.reply_to,
    domain,
    aliasId: alias.id,
    alias,
  };
}

function assertDomainReady(domain: Domain, projectId: string): void {
  if (domain.project_id !== projectId) {
    throw new SendingIdentityError(
      'DOMAIN_NOT_ALLOWED_FOR_PROJECT',
      'Ese dominio no pertenece a este proyecto.',
    );
  }
  if (domain.status !== 'verified') {
    throw new SendingIdentityError(
      'DOMAIN_NOT_VERIFIED',
      `El dominio ${domain.domain} no está verificado por DNS.`,
    );
  }
}

function assertAliasReady(alias: DomainAlias, domain: Domain, projectId: string): void {
  assertDomainReady(domain, projectId);
  if (!alias.is_active) {
    throw new SendingIdentityError(
      'SENDING_IDENTITY_DISABLED',
      `El alias ${alias.full_email} está desactivado.`,
    );
  }
}

function pickDefault(aliases: DomainAliasWithDomain[]): DomainAliasWithDomain | null {
  const defaults = aliases.filter((a) => a.is_default);
  if (defaults.length === 1) return defaults[0];
  return null;
}

async function hydrateDomain(
  store: SendingIdentityStore,
  alias: DomainAlias,
  fallback?: Domain,
): Promise<Domain> {
  if (fallback && fallback.id === alias.domain_id) return fallback;
  const domain = await store.findDomainById(alias.domain_id);
  if (!domain) {
    throw new SendingIdentityError(
      'DOMAIN_NOT_FOUND',
      'El dominio del alias no existe.',
    );
  }
  return domain;
}

/**
 * Resuelve la identidad de envío del proyecto.
 *
 * Preferencia:
 *  1. `aliasId` explícito
 *  2. `from` (email completo, p. ej. ventas@example.com)
 *  3. `domainId` + un solo alias / default de ese dominio
 *  4. `default_alias_id` del proyecto
 *  5. Un único alias sendable del proyecto
 *  6. Un único alias marcado is_default en el proyecto
 *  7. Error NO_DEFAULT_SENDING_IDENTITY
 */
export async function resolveSendingIdentityWithStore(
  store: SendingIdentityStore,
  input: ResolveSendingIdentityInput,
): Promise<ResolvedSendingIdentity> {
  const { projectId } = input;
  const project = await store.findProject(projectId);
  if (!project) {
    throw new SendingIdentityError(
      'SENDING_IDENTITY_NOT_ALLOWED',
      'El proyecto no existe.',
    );
  }

  if (input.aliasId) {
    const found = await store.findAliasById(input.aliasId);
    if (!found) {
      throw new SendingIdentityError(
        'SENDING_IDENTITY_NOT_FOUND',
        'El alias indicado no existe.',
      );
    }
    if (found.projectId !== projectId) {
      throw new SendingIdentityError(
        'SENDING_IDENTITY_NOT_ALLOWED',
        'Ese alias no pertenece a este proyecto.',
      );
    }
    assertAliasReady(found.alias, found.domain, projectId);
    return toResolved(found.alias, found.domain, input.fromName);
  }

  if (input.from) {
    const email = parseFromEmail(input.from);
    const found = await store.findAliasByFullEmail(email);
    if (!found) {
      throw new SendingIdentityError(
        'SENDING_IDENTITY_NOT_FOUND',
        `No hay un alias ${email} en MatuMailer.`,
      );
    }
    if (found.domain.project_id !== projectId) {
      throw new SendingIdentityError(
        'SENDING_IDENTITY_NOT_ALLOWED',
        `El remitente ${email} no pertenece a este proyecto.`,
      );
    }
    assertAliasReady(found.alias, found.domain, projectId);
    return toResolved(found.alias, found.domain, input.fromName);
  }

  if (input.domainId) {
    const domain = await store.findDomainById(input.domainId);
    if (!domain) {
      throw new SendingIdentityError('DOMAIN_NOT_FOUND', 'El dominio no existe.');
    }
    assertDomainReady(domain, projectId);
    const aliases = await store.listSendableAliases(projectId, domain.id);
    if (!aliases.length) {
      throw new SendingIdentityError(
        'NO_ALIAS_ON_DOMAIN',
        `Crea al menos un alias activo en ${domain.domain}.`,
      );
    }
    if (aliases.length === 1) {
      return toResolved(aliases[0], domain, input.fromName);
    }
    const def = pickDefault(aliases);
    if (def) return toResolved(def, domain, input.fromName);
    throw new SendingIdentityError(
      'NO_DEFAULT_SENDING_IDENTITY',
      `Hay varios aliases en ${domain.domain}. Indica from (ej. ${aliases[0].full_email}) o marca un remitente predeterminado.`,
    );
  }

  if (project.default_alias_id) {
    const found = await store.findAliasById(project.default_alias_id);
    if (found && found.projectId === projectId) {
      try {
        assertAliasReady(found.alias, found.domain, projectId);
        return toResolved(found.alias, found.domain, input.fromName);
      } catch {
        /* default inválido: caer al resto de reglas */
      }
    }
  }

  const aliases = await store.listSendableAliases(projectId);
  if (!aliases.length) {
    const domains = await store.listDomainsByProject(projectId);
    if (!domains.some((d) => d.status === 'verified')) {
      throw new SendingIdentityError(
        'NO_VERIFIED_DOMAIN',
        'Agrega y verifica un dominio por DNS antes de enviar correos.',
      );
    }
    throw new SendingIdentityError(
      'NO_ALIAS_ON_DOMAIN',
      'Crea al menos un alias activo en un dominio verificado (ej. hola@tudominio.com).',
    );
  }

  if (aliases.length === 1) {
    const domain = await hydrateDomain(store, aliases[0]);
    assertDomainReady(domain, projectId);
    return toResolved(aliases[0], domain, input.fromName);
  }

  const def = pickDefault(aliases);
  if (def) {
    const domain = await hydrateDomain(store, def);
    assertDomainReady(domain, projectId);
    return toResolved(def, domain, input.fromName);
  }

  const emails = aliases.map((a) => a.full_email).join(', ');
  throw new SendingIdentityError(
    'NO_DEFAULT_SENDING_IDENTITY',
    `El proyecto tiene ${aliases.length} aliases listos para enviar. Indica from (ej. ${aliases[0].full_email}) o marca un remitente predeterminado. Disponibles: ${emails}`,
  );
}

export const liveSendingIdentityStore: SendingIdentityStore = {
  async findProject(projectId) {
    return projectsRepo.findProjectById(projectId);
  },
  async findAliasById(aliasId) {
    const found = await aliasesRepo.findAliasById(aliasId);
    if (!found) return null;
    const domain = await domainsRepo.findDomainById(found.alias.domain_id);
    if (!domain) return null;
    return { alias: found.alias, projectId: found.projectId, domain };
  },
  async findAliasByFullEmail(fullEmail) {
    return aliasesRepo.findAliasRowByEmail(fullEmail);
  },
  findDomainById: (id) => domainsRepo.findDomainById(id),
  listSendableAliases: (projectId, domainId) =>
    aliasesRepo.listSendableAliases(projectId, domainId),
  listDomainsByProject: (projectId) => domainsRepo.listDomainsByProject(projectId),
};

export function resolveSendingIdentity(
  input: ResolveSendingIdentityInput,
): Promise<ResolvedSendingIdentity> {
  return resolveSendingIdentityWithStore(liveSendingIdentityStore, input);
}
