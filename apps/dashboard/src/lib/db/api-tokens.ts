import { getMatuDb } from '@/lib/matudb';

export interface ApiTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  can_copy: boolean;
  created_at: string;
}

export async function listApiTokens(projectId: string): Promise<ApiTokenRow[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('api_tokens')
    .select('id, project_id, name, token_prefix, token_encrypted, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    name: string;
    token_prefix: string;
    token_encrypted?: string | null;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    token_prefix: r.token_prefix,
    can_copy: !!r.token_encrypted,
    created_at: r.created_at,
  }));
}

export async function deleteApiToken(tokenId: string): Promise<void> {
  const db = getMatuDb();
  const { error } = await db.from('api_tokens').eq('id', tokenId).delete();
  if (error) throw new Error(error.message);
}
