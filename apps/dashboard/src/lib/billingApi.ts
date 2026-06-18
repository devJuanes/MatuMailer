import { api } from './api';
import type { SubscriptionPlanId } from '@/constants/plans';

export type PlanTier = 'free' | 'premium';

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  payment_reference?: string | null;
  amount?: number | null;
  currency?: string;
  starts_at?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
}

export interface PlanStatus {
  tier: PlanTier;
  subscription: Subscription | null;
  limits: {
    maxProjects: number;
    maxSmtpConfigs: number;
    maxCustomTemplates: number;
    maxTestEmails: number;
    maxEmailsPerWindow: number;
    emailWindowHours: number;
  } | null;
  usage: {
    projects: number;
    smtpConfigs: number;
    customTemplates: number;
    testEmails: number;
    emailsInWindow: number;
  };
}

export function fetchPlanStatus() {
  return api<PlanStatus>('/api/billing/status');
}

export function fetchPlans() {
  return api<{
    plans: Array<{
      id: SubscriptionPlanId;
      amount: number;
      months: number;
      name: string;
      description: string;
      currency: string;
      badge?: string;
      savings?: string;
      featured?: boolean;
    }>;
    monthlyPrice: number;
  }>('/api/billing/plans');
}

export function createCheckout(planId: SubscriptionPlanId) {
  return api<{ checkoutUrl: string; reference: string; amount: number; currency: string }>(
    '/api/billing/checkout',
    {
      method: 'POST',
      body: JSON.stringify({ planId }),
    },
  );
}

export function confirmPayment(reference: string) {
  return api<{ paid: boolean; status: string; subscription: Subscription | null }>(
    '/api/billing/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ reference }),
    },
  );
}

export function signupCheckout(
  name: string,
  email: string,
  password: string,
  planId: SubscriptionPlanId,
) {
  return api<{ checkoutUrl: string; reference: string; amount: number; currency: string }>(
    '/api/billing/signup-checkout',
    {
      method: 'POST',
      body: JSON.stringify({ name, email, password, planId }),
      token: null,
    },
  );
}

export function signupConfirm(reference: string) {
  return api<{
    paid: boolean;
    status?: string;
    accountCreated: boolean;
    email?: string;
    token?: string;
    alreadyCompleted?: boolean;
  }>('/api/billing/signup-confirm', {
    method: 'POST',
    body: JSON.stringify({ reference }),
    token: null,
  });
}

export const SIGNUP_STORAGE_KEY = 'matumailer_signup_draft';

export interface SignupDraft {
  name: string;
  email: string;
  password: string;
  planId: SubscriptionPlanId;
}

export function saveSignupDraft(draft: SignupDraft) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(draft));
  }
}

export function loadSignupDraft(): SignupDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SIGNUP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignupDraft) : null;
  } catch {
    return null;
  }
}

export function clearSignupDraft() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SIGNUP_STORAGE_KEY);
  }
}

export function isPremium(status: PlanStatus | null): boolean {
  return status?.tier === 'premium';
}
