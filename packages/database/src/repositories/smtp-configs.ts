import type { SmtpConfig } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateMany, updateOne } from '../helpers';

export async function findSmtpByProjectId(projectId: string): Promise<SmtpConfig | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('smtp_configs')
    .select('*')
    .eq('project_id', projectId)
    .single();
  if (error || !data) return null;
  return data as SmtpConfig;
}

export async function upsertSmtpConfig(
  projectId: string,
  input: Omit<SmtpConfig, 'id' | 'project_id' | 'created_at' | 'updated_at' | 'is_verified'> & {
    is_verified?: boolean;
  },
): Promise<SmtpConfig> {
  const existing = await findSmtpByProjectId(projectId);

  if (existing) {
    return updateOne<SmtpConfig>(
      'smtp_configs',
      [{ column: 'project_id', value: projectId }],
      { ...input, updated_at: new Date().toISOString() },
    );
  }

  return insertOne<SmtpConfig>('smtp_configs', { project_id: projectId, ...input });
}

export async function markSmtpVerified(projectId: string): Promise<void> {
  await updateMany('smtp_configs', [{ column: 'project_id', value: projectId }], {
    is_verified: true,
  });
}
