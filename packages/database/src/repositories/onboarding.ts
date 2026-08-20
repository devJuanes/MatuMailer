import { getMatuDb } from '../client';
import { insertOne, updateOne } from '../helpers';

export interface ProjectOnboarding {
  project_id: string;
  test_email_sent_at: string | null;
  updated_at: string;
}

export async function findOnboardingByProjectId(
  projectId: string,
): Promise<ProjectOnboarding | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('project_onboarding')
    .select('*')
    .eq('project_id', projectId)
    .single();
  if (error || !data) return null;
  return data as ProjectOnboarding;
}

export async function markDomainReady(projectId: string): Promise<void> {
  const existing = await findOnboardingByProjectId(projectId);
  const now = new Date().toISOString();
  if (existing) return;
  await insertOne<ProjectOnboarding>('project_onboarding', {
    project_id: projectId,
    test_email_sent_at: null,
    updated_at: now,
  });
}

export async function markTestEmailSent(projectId: string): Promise<void> {
  const existing = await findOnboardingByProjectId(projectId);
  const now = new Date().toISOString();
  if (existing) {
    await updateOne<ProjectOnboarding>(
      'project_onboarding',
      [{ column: 'project_id', value: projectId }],
      { test_email_sent_at: now, updated_at: now },
    );
    return;
  }
  await insertOne<ProjectOnboarding>('project_onboarding', {
    project_id: projectId,
    test_email_sent_at: now,
    updated_at: now,
  });
}
