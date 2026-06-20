import type { ApiToken } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateMany } from '../helpers';

export type ApiTokenPublic = Omit<ApiToken, 'token_hash' | 'token_encrypted'> & {
  can_copy: boolean;
};

export async function findTokensByProjectId(projectId: string): Promise<ApiTokenPublic[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('api_tokens')
    .select(
      'id, project_id, name, token_prefix, token_encrypted, last_used_at, expires_at, created_at',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (ApiToken & { token_encrypted?: string | null })[];
  return rows.map((r) => {
    const { token_hash: _h, token_encrypted, ...rest } = r;
    return {
      ...rest,
      can_copy: !!token_encrypted,
    };
  });
}

export async function findTokenById(id: string): Promise<ApiToken | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('api_tokens').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as ApiToken;
}

export async function findTokenByHash(tokenHash: string): Promise<ApiToken | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('api_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  return data as ApiToken;
}

export async function createApiToken(input: {
  project_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  token_encrypted?: string | null;
  expires_at?: string | null;
}): Promise<ApiToken> {
  return insertOne<ApiToken>('api_tokens', input);
}

export async function updateTokenLastUsed(id: string): Promise<void> {
  await updateMany('api_tokens', [{ column: 'id', value: id }], {
    last_used_at: new Date().toISOString(),
  });
}

export async function deleteApiToken(id: string): Promise<void> {
  const db = getMatuDb();
  await db.from('api_tokens').eq('id', id).delete();
}
