import type { PlanStatus } from '@/lib/billingApi';
import { FREE_LIMITS } from '@/constants/plans';

type LimitFallback = {
  used: number;
  max?: number;
};

function resolveFreeLimit(
  plan: PlanStatus | null,
  isPremium: boolean,
  key: keyof typeof FREE_LIMITS,
  fallback?: LimitFallback,
): { allowed: boolean; used: number; max: number } {
  if (isPremium) {
    return {
      allowed: true,
      used: fallback?.used ?? 0,
      max: fallback?.max ?? (FREE_LIMITS[key] as number),
    };
  }

  const max =
    (plan?.limits?.[key] as number | undefined) ?? fallback?.max ?? (FREE_LIMITS[key] as number);
  const used =
    key === 'maxProjects'
      ? (plan?.usage.projects ?? fallback?.used ?? 0)
      : key === 'maxSmtpConfigs'
        ? (plan?.usage.smtpConfigs ?? fallback?.used ?? 0)
        : key === 'maxCustomTemplates'
          ? (plan?.usage.customTemplates ?? fallback?.used ?? 0)
          : key === 'maxTestEmails'
            ? (plan?.usage.testEmails ?? fallback?.used ?? 0)
            : (plan?.usage.emailsInWindow ?? fallback?.used ?? 0);

  return { allowed: used < max, used, max };
}

export function canCreateProject(
  plan: PlanStatus | null,
  isPremium: boolean,
  localProjectCount?: number,
): boolean {
  return resolveFreeLimit(plan, isPremium, 'maxProjects', {
    used: localProjectCount ?? plan?.usage.projects ?? 0,
  }).allowed;
}

export function canCreateTemplate(
  plan: PlanStatus | null,
  isPremium: boolean,
  localCustomCount?: number,
): boolean {
  return resolveFreeLimit(plan, isPremium, 'maxCustomTemplates', {
    used: localCustomCount ?? plan?.usage.customTemplates ?? 0,
  }).allowed;
}

export function canConfigureSmtp(
  plan: PlanStatus | null,
  isPremium: boolean,
  hasSmtpOnCurrentProject: boolean,
  localSmtpCount?: number,
): boolean {
  if (isPremium) return true;
  if (hasSmtpOnCurrentProject) return true;
  return resolveFreeLimit(plan, isPremium, 'maxSmtpConfigs', {
    used: localSmtpCount ?? plan?.usage.smtpConfigs ?? 0,
  }).allowed;
}

export function canSendTestEmail(
  plan: PlanStatus | null,
  isPremium: boolean,
  localTestCount?: number,
): boolean {
  return resolveFreeLimit(plan, isPremium, 'maxTestEmails', {
    used: localTestCount ?? plan?.usage.testEmails ?? 0,
  }).allowed;
}

export function canSendEmail(
  plan: PlanStatus | null,
  isPremium: boolean,
  localEmailWindowCount?: number,
): boolean {
  return resolveFreeLimit(plan, isPremium, 'maxEmailsPerWindow', {
    used: localEmailWindowCount ?? plan?.usage.emailsInWindow ?? 0,
  }).allowed;
}

export function projectLimitState(
  plan: PlanStatus | null,
  isPremium: boolean,
  localProjectCount: number,
) {
  return resolveFreeLimit(plan, isPremium, 'maxProjects', { used: localProjectCount });
}

export function templateLimitState(
  plan: PlanStatus | null,
  isPremium: boolean,
  localCustomCount: number,
) {
  return resolveFreeLimit(plan, isPremium, 'maxCustomTemplates', { used: localCustomCount });
}

export function smtpLimitState(
  plan: PlanStatus | null,
  isPremium: boolean,
  localSmtpCount: number,
  hasSmtpOnCurrentProject: boolean,
) {
  if (isPremium || hasSmtpOnCurrentProject) {
    return { allowed: true, used: localSmtpCount, max: FREE_LIMITS.maxSmtpConfigs };
  }
  return resolveFreeLimit(plan, isPremium, 'maxSmtpConfigs', { used: localSmtpCount });
}

export function usageRatio(used: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export function limitMessage(feature: string, used: number, max: number): string {
  return `Límite del plan gratis alcanzado: ${used}/${max} ${feature}. Actualiza a Premium para continuar.`;
}

export { FREE_LIMITS };
