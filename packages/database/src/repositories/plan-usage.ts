import { FREE_PLAN_LIMITS } from '@matumailer/shared';
import { getMatuDb } from '../client';
import * as projectsRepo from './projects';
import * as subscriptionsRepo from './subscriptions';

export async function countProjectsByUserId(userId: string): Promise<number> {
  const projects = await projectsRepo.findProjectsByUserId(userId);
  return projects.length;
}

export async function countCustomTemplatesByUserId(userId: string): Promise<number> {
  const db = getMatuDb();
  const projects = await projectsRepo.findProjectsByUserId(userId);
  if (projects.length === 0) return 0;

  let total = 0;
  for (const project of projects) {
    const { data, error } = await db
      .from('templates')
      .select('id')
      .eq('project_id', project.id)
      .eq('is_system', false);
    if (error) throw new Error(error.message);
    total += (data ?? []).length;
  }
  return total;
}

export async function countSmtpConfigsByUserId(userId: string): Promise<number> {
  const db = getMatuDb();
  const projects = await projectsRepo.findProjectsByUserId(userId);
  if (projects.length === 0) return 0;

  let total = 0;
  for (const project of projects) {
    const { data, error } = await db
      .from('smtp_configs')
      .select('id')
      .eq('project_id', project.id)
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.length) total += 1;
  }
  return total;
}

export async function countTestEmailsByUserId(userId: string): Promise<number> {
  const projects = await projectsRepo.findProjectsByUserId(userId);
  if (projects.length === 0) return 0;

  const db = getMatuDb();
  let total = 0;
  for (const project of projects) {
    const { data, error } = await db.rpc(`
      SELECT COUNT(*)::int AS count
      FROM email_logs
      WHERE project_id = '${project.id}'
        AND metadata->>'isTest' = 'true'
    `);
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as { count: number };
    total += row?.count ?? 0;
  }
  return total;
}

export async function countSentEmailsInWindow(userId: string, hours: number): Promise<number> {
  const projects = await projectsRepo.findProjectsByUserId(userId);
  if (projects.length === 0) return 0;

  const db = getMatuDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  let total = 0;

  for (const project of projects) {
    const { data, error } = await db
      .from('email_logs')
      .select('id')
      .eq('project_id', project.id)
      .in('status', ['sent', 'queued'])
      .gte('created_at', since);
    if (error) throw new Error(error.message);
    total += (data ?? []).length;
  }
  return total;
}

export async function isSmtpUsernameUsedByOtherFreeUser(
  username: string,
  currentUserId: string,
): Promise<boolean> {
  const db = getMatuDb();
  const normalized = username.trim().toLowerCase();

  const { data: smtpRows, error } = await db.from('smtp_configs').select('project_id, username');
  if (error) throw new Error(error.message);

  for (const smtp of smtpRows ?? []) {
    if (String(smtp.username).trim().toLowerCase() !== normalized) continue;

    const project = await projectsRepo.findProjectById(smtp.project_id);
    if (!project || project.user_id === currentUserId) continue;

    const active = await subscriptionsRepo.findActiveSubscription(project.user_id);
    if (!active) return true;
  }

  return false;
}

export function getFreeLimitsSummary() {
  return { ...FREE_PLAN_LIMITS };
}
