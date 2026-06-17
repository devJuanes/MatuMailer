export type SubscriptionPlanId = 'plan-mensual' | 'plan-semestral' | 'plan-anual';

export type PlanTier = 'free' | 'premium';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  description: string;
  amount: number;
  months: number;
  currency: 'COP';
  badge?: string;
  savings?: string;
  featured?: boolean;
}

export const MONTHLY_PRICE = 25000;

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-mensual',
    name: 'Mensual',
    description: 'Renovación cada mes. Ideal para empezar sin compromiso largo.',
    amount: MONTHLY_PRICE,
    months: 1,
    currency: 'COP',
  },
  {
    id: 'plan-semestral',
    name: 'Semestral',
    description: '6 meses de MatuMailer Premium con 10% de descuento.',
    amount: 135000,
    months: 6,
    currency: 'COP',
    badge: '10% OFF',
    savings: 'Ahorras $15.000 vs pagar mes a mes',
    featured: true,
  },
  {
    id: 'plan-anual',
    name: 'Anual',
    description: '12 meses con el mejor precio — 20% de descuento.',
    amount: 240000,
    months: 12,
    currency: 'COP',
    badge: '20% OFF',
    savings: 'Ahorras $60.000 vs pagar mes a mes',
  },
];

export const PLAN_BY_ID = Object.fromEntries(SUBSCRIPTION_PLANS.map((p) => [p.id, p])) as Record<
  SubscriptionPlanId,
  SubscriptionPlan
>;

export const FREE_PLAN_LIMITS = {
  maxProjects: 1,
  maxSmtpConfigs: 1,
  maxCustomTemplates: 3,
  maxTestEmails: 5,
  maxEmailsPerWindow: 10,
  emailWindowHours: 10,
} as const;

export function planLabel(planId: string): string {
  return PLAN_BY_ID[planId as SubscriptionPlanId]?.name ?? planId;
}

export function isPaidSubscriptionStatus(status: string): boolean {
  return ['PAID', 'APPROVED', 'SALE_APPROVED'].includes(status.toUpperCase());
}
