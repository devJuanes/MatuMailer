import type { Domain, DomainAlias, DomainAliasWithDomain } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateOne } from '../helpers';
import { findDomainById, getProjectDefaultDomain, listDomainsByProject } from './domains';

/**
 * Repositorio de aliases (`info@dominio.com`, `support@dominio.com`, ...).
 *
 * Cada alias está vinculado a un `mailer_domains` verificado. La validación de
 * pertenencia (que el alias pertenezca al proyecto y a un dominio verificado)
 * se hace en la capa de rutas; aquí solo operamos sobre filas.
 *
 * IMPORTANTE: MatuDB no soporta la sintaxis `!inner` de Supabase (es PostgREST
 * puro). Para enriquecer con datos del dominio padre hacemos un lookup en
 * dos pasos: primero filtramos por alias, luego hidratamos con la query
 * de dominios (`./domains`).
 */

const SELECT_ALIAS =
  'id, domain_id, local_part, full_email, display_name, reply_to, is_active, is_default, created_at, updated_at';

interface DomainCacheEntry {
  id: string;
  domain: string;
  status: string;
  project_id: string;
  default_domain_id?: string | null;
}

/**
 * Hidrata una lista de alias con el `domain` (texto) del `mailer_domains` padre.
 * Cachea los dominios consultados para minimizar round-trips cuando hay N aliases
 * del mismo dominio.
 */
async function hydrate(rows: DomainAlias[], projectId: string): Promise<DomainAliasWithDomain[]> {
  if (!rows.length) return [];

  // Trae todos los dominios del proyecto en una sola query.
  const allDomains = await listDomainsByProject(projectId);
  const byId = new Map<string, DomainCacheEntry>();
  for (const d of allDomains) byId.set(d.id, d);

  return rows.map((row) => {
    const d = byId.get(row.domain_id);
    return { ...row, domain: d?.domain ?? '' };
  });
}

/** Lista aliases de un proyecto. Si se pasa `domainId`, filtra por dominio. */
export async function listAliases(
  projectId: string,
  opts: { domainId?: string; activeOnly?: boolean } = {},
): Promise<DomainAliasWithDomain[]> {
  const db = getMatuDb();
  let query = db
    .from('mailer_domain_aliases')
    .select(SELECT_ALIAS)
    .eq('domain_id', opts.domainId ?? '__any__');

  // Si no se pasa domainId, tenemos que resolver primero qué dominios
  // pertenecen al proyecto para no devolver aliases de otros proyectos.
  if (!opts.domainId) {
    const domains = await listDomainsByProject(projectId);
    const ids = domains.map((d) => d.id);
    if (!ids.length) return [];
    query = db.from('mailer_domain_aliases').select(SELECT_ALIAS).in('domain_id', ids);
  }

  if (opts.activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return hydrate((data ?? []) as DomainAlias[], projectId);
}

/** Alias por id (sin filtro de proyecto — el caller valida ownership). */
export async function findAliasById(
  aliasId: string,
): Promise<{ alias: DomainAlias; projectId: string; domain: string } | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('mailer_domain_aliases')
    .select(SELECT_ALIAS)
    .eq('id', aliasId)
    .maybeSingle();
  if (error || !data) return null;
  const alias = data as DomainAlias;
  const domain = await findDomainById(alias.domain_id);
  if (!domain) return null;
  return { alias, projectId: domain.project_id, domain: domain.domain };
}

/** Alias por email completo, sin filtrar proyecto ni verificación (el caller valida). */
export async function findAliasRowByEmail(
  fullEmail: string,
): Promise<{ alias: DomainAlias; domain: Domain } | null> {
  const db = getMatuDb();
  const normalized = fullEmail.toLowerCase().trim();
  const { data, error } = await db
    .from('mailer_domain_aliases')
    .select(SELECT_ALIAS)
    .eq('full_email', normalized)
    .maybeSingle();
  if (error || !data) return null;
  const alias = data as DomainAlias;
  const domain = await findDomainById(alias.domain_id);
  if (!domain) return null;
  return { alias, domain };
}

/**
 * Busca un alias por su `full_email` dentro del proyecto. Valida que el
 * alias esté activo y el dominio verificado (requisito del envío).
 */
export async function findAliasByEmail(
  projectId: string,
  fullEmail: string,
): Promise<DomainAliasWithDomain | null> {
  const found = await findAliasRowByEmail(fullEmail);
  if (!found) return null;
  if (found.domain.project_id !== projectId) return null;
  if (!found.alias.is_active) return null;
  if (found.domain.status !== 'verified') return null;
  return { ...found.alias, domain: found.domain.domain };
}

/**
 * Alias por defecto del proyecto (el `is_default=true` del dominio por defecto).
 * Usado cuando el caller no especifica `from` y solo hay un dominio verificado.
 */
export async function findDefaultAlias(projectId: string): Promise<DomainAliasWithDomain | null> {
  const db = getMatuDb();
  // 1) Hallar el dominio default del proyecto (verificado)
  const defaultDomain = await getProjectDefaultDomain(projectId);
  if (!defaultDomain || defaultDomain.status !== 'verified') return null;

  // 2) Buscar alias default en ese dominio
  const { data, error } = await db
    .from('mailer_domain_aliases')
    .select(SELECT_ALIAS)
    .eq('domain_id', defaultDomain.id)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return { ...(data as DomainAlias), domain: defaultDomain.domain };
}

/** Busca el primer alias activo de un dominio (cualquiera — fallback). */
export async function findFirstActiveAlias(
  domainId: string,
): Promise<DomainAliasWithDomain | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('mailer_domain_aliases')
    .select(SELECT_ALIAS)
    .eq('domain_id', domainId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .maybeSingle();
  if (error || !data) return null;
  const alias = data as DomainAlias;
  const domain = await findDomainById(domainId);
  return { ...alias, domain: domain?.domain ?? '' };
}

/**
 * Cualquier alias activo de un dominio verificado del proyecto. Usado como
 * fallback final cuando no hay alias default ni dominio default.
 */
export async function findAnyActiveAliasForProject(
  projectId: string,
): Promise<DomainAliasWithDomain | null> {
  const aliases = await listSendableAliases(projectId);
  return aliases[0] ?? null;
}

/** Aliases activos cuyo dominio padre está verificado (listos para enviar). */
export async function listSendableAliases(
  projectId: string,
  domainId?: string,
): Promise<DomainAliasWithDomain[]> {
  const aliases = await listAliases(projectId, { domainId, activeOnly: true });
  const domains = await listDomainsByProject(projectId);
  const verified = new Set(domains.filter((d) => d.status === 'verified').map((d) => d.id));
  return aliases.filter((a) => verified.has(a.domain_id));
}

export async function createAlias(input: {
  domain_id: string;
  local_part: string;
  full_email: string;
  display_name?: string | null;
  reply_to?: string | null;
  is_active?: boolean;
  is_default?: boolean;
}): Promise<DomainAlias> {
  return insertOne<DomainAlias>('mailer_domain_aliases', {
    domain_id: input.domain_id,
    local_part: input.local_part,
    full_email: input.full_email,
    display_name: input.display_name ?? null,
    reply_to: input.reply_to ?? null,
    is_active: input.is_active ?? true,
    is_default: input.is_default ?? false,
  });
}

export async function updateAlias(
  aliasId: string,
  updates: Partial<{
    display_name: string | null;
    reply_to: string | null;
    is_active: boolean;
    is_default: boolean;
  }>,
): Promise<DomainAlias> {
  return updateOne<DomainAlias>(
    'mailer_domain_aliases',
    [{ column: 'id', value: aliasId }],
    updates,
  );
}

export async function deleteAlias(id: string): Promise<void> {
  const db = getMatuDb();
  const { error } = await db.from('mailer_domain_aliases').eq('id', id).delete();
  if (error) throw new Error(error.message);
}

export async function unsetDefaultInDomain(domainId: string): Promise<void> {
  // La constraint parcial `uq_mailer_domain_aliases_default` permite solo una
  // fila `is_default=true` por dominio. Antes de marcar una nueva como
  // default, desmarcamos las demás en la misma operación.
  const db = getMatuDb();
  const { error } = await db
    .from('mailer_domain_aliases')
    .eq('domain_id', domainId)
    .update({ is_default: false });
  if (error) throw new Error(error.message);
}

/** Quita el default de todos los aliases del proyecto (un remitente predeterminado por proyecto). */
export async function unsetDefaultInProject(projectId: string): Promise<void> {
  const domains = await listDomainsByProject(projectId);
  const ids = domains.map((d) => d.id);
  if (!ids.length) return;
  const db = getMatuDb();
  const { error } = await db
    .from('mailer_domain_aliases')
    .in('domain_id', ids)
    .update({ is_default: false });
  if (error) throw new Error(error.message);
}
