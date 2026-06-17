import { FREE_PLAN_LIMITS, type PlanTier } from '@matumailer/shared';
import {
  planUsageRepo,
  smtpConfigsRepo,
  subscriptionsRepo,
  projectsRepo,
} from '@matumailer/database';

export class PlanLimitError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PlanLimitError';
    this.code = code;
    this.details = details;
  }
}

export interface PlanUsage {
  projects: number;
  smtpConfigs: number;
  customTemplates: number;
  testEmails: number;
  emailsInWindow: number;
}

export interface PlanStatus {
  tier: PlanTier;
  subscription: Awaited<ReturnType<typeof subscriptionsRepo.findActiveSubscription>>;
  limits: typeof FREE_PLAN_LIMITS | null;
  usage: PlanUsage;
}

export async function isPremiumUser(userId: string): Promise<boolean> {
  const sub = await subscriptionsRepo.findActiveSubscription(userId);
  return !!sub;
}

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const subscription = await subscriptionsRepo.findActiveSubscription(userId);
  const tier: PlanTier = subscription ? 'premium' : 'free';

  const usage: PlanUsage = {
    projects: await planUsageRepo.countProjectsByUserId(userId),
    smtpConfigs: await planUsageRepo.countSmtpConfigsByUserId(userId),
    customTemplates: await planUsageRepo.countCustomTemplatesByUserId(userId),
    testEmails: await planUsageRepo.countTestEmailsByUserId(userId),
    emailsInWindow: await planUsageRepo.countSentEmailsInWindow(
      userId,
      FREE_PLAN_LIMITS.emailWindowHours,
    ),
  };

  return {
    tier,
    subscription,
    limits: tier === 'free' ? { ...FREE_PLAN_LIMITS } : null,
    usage,
  };
}

export async function assertCanCreateProject(userId: string): Promise<void> {
  if (await isPremiumUser(userId)) return;
  const count = await planUsageRepo.countProjectsByUserId(userId);
  if (count >= FREE_PLAN_LIMITS.maxProjects) {
    throw new PlanLimitError(
      'PROJECT_LIMIT',
      `Plan gratis: máximo ${FREE_PLAN_LIMITS.maxProjects} proyectos. Actualiza a Premium para crear más.`,
      { limit: FREE_PLAN_LIMITS.maxProjects, current: count },
    );
  }
}

export async function assertCanConfigureSmtp(
  userId: string,
  projectId: string,
  username: string,
): Promise<void> {
  if (await isPremiumUser(userId)) return;

  const usedElsewhere = await planUsageRepo.isSmtpUsernameUsedByOtherFreeUser(username, userId);
  if (usedElsewhere) {
    throw new PlanLimitError(
      'SMTP_ALREADY_USED',
      'Este correo SMTP ya está registrado en otra cuenta gratis. Usa otro correo o actualiza a Premium.',
    );
  }

  const count = await planUsageRepo.countSmtpConfigsByUserId(userId);
  const existing = await smtpConfigsRepo.findSmtpByProjectId(projectId);
  if (!existing && count >= FREE_PLAN_LIMITS.maxSmtpConfigs) {
    throw new PlanLimitError(
      'SMTP_LIMIT',
      `Plan gratis: solo ${FREE_PLAN_LIMITS.maxSmtpConfigs} configuración SMTP por cuenta.`,
      { limit: FREE_PLAN_LIMITS.maxSmtpConfigs, current: count },
    );
  }
}

export async function assertCanCreateTemplate(userId: string): Promise<void> {
  if (await isPremiumUser(userId)) return;
  const count = await planUsageRepo.countCustomTemplatesByUserId(userId);
  if (count >= FREE_PLAN_LIMITS.maxCustomTemplates) {
    throw new PlanLimitError(
      'TEMPLATE_LIMIT',
      `Plan gratis: máximo ${FREE_PLAN_LIMITS.maxCustomTemplates} plantillas personalizadas.`,
      { limit: FREE_PLAN_LIMITS.maxCustomTemplates, current: count },
    );
  }
}

export async function assertCanSendTestEmail(userId: string): Promise<void> {
  if (await isPremiumUser(userId)) return;
  const count = await planUsageRepo.countTestEmailsByUserId(userId);
  if (count >= FREE_PLAN_LIMITS.maxTestEmails) {
    throw new PlanLimitError(
      'TEST_EMAIL_LIMIT',
      `Plan gratis: máximo ${FREE_PLAN_LIMITS.maxTestEmails} correos de prueba.`,
      { limit: FREE_PLAN_LIMITS.maxTestEmails, current: count },
    );
  }
  await assertCanSendEmails(userId, 1);
}

export async function assertCanSendEmails(userId: string, count = 1): Promise<void> {
  if (await isPremiumUser(userId)) return;
  const sent = await planUsageRepo.countSentEmailsInWindow(
    userId,
    FREE_PLAN_LIMITS.emailWindowHours,
  );
  if (sent + count > FREE_PLAN_LIMITS.maxEmailsPerWindow) {
    throw new PlanLimitError(
      'EMAIL_RATE_LIMIT',
      `Plan gratis: máximo ${FREE_PLAN_LIMITS.maxEmailsPerWindow} correos cada ${FREE_PLAN_LIMITS.emailWindowHours} horas.`,
      {
        limit: FREE_PLAN_LIMITS.maxEmailsPerWindow,
        windowHours: FREE_PLAN_LIMITS.emailWindowHours,
        current: sent,
        requested: count,
      },
    );
  }
}

export async function assertCanBulkSend(userId: string): Promise<void> {
  if (await isPremiumUser(userId)) return;
  throw new PlanLimitError(
    'BULK_NOT_AVAILABLE',
    'El envío masivo está disponible solo en Premium.',
  );
}

export async function assertCanScheduleSend(userId: string): Promise<void> {
  if (await isPremiumUser(userId)) return;
  throw new PlanLimitError(
    'SCHEDULE_NOT_AVAILABLE',
    'Los envíos programados están disponibles solo en Premium.',
  );
}

export function planLimitReply(error: PlanLimitError) {
  return {
    error: error.code,
    message: error.message,
    details: error.details,
    upgradeRequired: true,
  };
}

export function isPlanLimitError(err: unknown): err is PlanLimitError {
  return err instanceof PlanLimitError;
}

export async function getUserIdForProject(projectId: string): Promise<string | null> {
  const project = await projectsRepo.findProjectById(projectId);
  return project?.user_id ?? null;
}

export async function assertCanSendForProject(
  projectId: string,
  options: { isTest?: boolean; count?: number; bulk?: boolean; schedule?: boolean } = {},
): Promise<string> {
  const userId = await getUserIdForProject(projectId);
  if (!userId) throw new Error('PROJECT_NOT_FOUND');

  if (options.schedule) await assertCanScheduleSend(userId);
  if (options.bulk) await assertCanBulkSend(userId);
  if (options.isTest) {
    await assertCanSendTestEmail(userId);
  } else {
    await assertCanSendEmails(userId, options.count ?? 1);
  }

  return userId;
}
