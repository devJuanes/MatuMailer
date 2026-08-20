import { api } from '@/lib/api';

/**
 * Tipos del módulo de aliases (espejo de `@matumailer/shared` para el front).
 * Mantenerlos en sync cuando se actualice el backend.
 */
export type Alias = {
  id: string;
  domain_id: string;
  local_part: string;
  full_email: string;
  display_name: string | null;
  reply_to: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  domain: string;
};

export async function listAliases(
  projectId: string,
  opts: { domainId?: string; activeOnly?: boolean } = {},
): Promise<Alias[]> {
  const params = new URLSearchParams({ projectId });
  if (opts.domainId) params.set('domainId', opts.domainId);
  if (opts.activeOnly) params.set('activeOnly', 'true');
  const res = await api<{ aliases: Alias[] }>(`/api/aliases?${params}`);
  return res.aliases;
}

export async function createAlias(
  projectId: string,
  payload: {
    domainId: string;
    localPart: string;
    displayName?: string | null;
    replyTo?: string | null;
    isDefault?: boolean;
  },
): Promise<Alias> {
  const res = await api<{ alias: Alias }>(`/api/aliases?projectId=${projectId}`, {
    method: 'POST',
    body: JSON.stringify({
      domainId: payload.domainId,
      localPart: payload.localPart,
      displayName: payload.displayName ?? null,
      replyTo: payload.replyTo ?? null,
      isActive: true,
      isDefault: payload.isDefault ?? false,
    }),
  });
  return res.alias;
}

export async function updateAlias(
  id: string,
  payload: {
    displayName?: string | null;
    replyTo?: string | null;
    isActive?: boolean;
    isDefault?: boolean;
  },
): Promise<Alias> {
  const res = await api<{ alias: Alias }>(`/api/aliases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.alias;
}

export async function deleteAlias(id: string): Promise<void> {
  await api<{ deleted: boolean }>(`/api/aliases/${id}`, { method: 'DELETE' });
}
