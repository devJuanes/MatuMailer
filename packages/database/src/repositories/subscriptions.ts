import type { SubscriptionPlanId } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { isMissingTableError } from '../db-errors';
import { insertOne, updateOne } from '../helpers';

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: SubscriptionPlanId;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  payment_reference: string | null;
  amount: number | null;
  currency: string;
  link_id: string | null;
  transaction_id: string | null;
  starts_at: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function findActiveSubscription(userId: string): Promise<Subscription | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(5);

  if (error) {
    if (isMissingTableError(error, 'subscriptions')) return null;
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Subscription[];
  const now = new Date();
  return rows.find((r) => !r.expires_at || new Date(r.expires_at) > now) ?? null;
}

export async function findSubscriptionByReference(reference: string): Promise<Subscription | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('subscriptions')
    .select('*')
    .eq('payment_reference', reference)
    .single();
  if (error || !data) return null;
  return data as Subscription;
}

export async function findSubscriptionsByUserId(userId: string): Promise<Subscription[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    if (isMissingTableError(error, 'subscriptions')) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Subscription[];
}

export async function createPendingSubscription(input: {
  user_id: string;
  plan_id: SubscriptionPlanId;
  payment_reference: string;
  amount: number;
  currency?: string;
}): Promise<Subscription> {
  return insertOne<Subscription>('subscriptions', {
    user_id: input.user_id,
    plan_id: input.plan_id,
    status: 'pending',
    payment_reference: input.payment_reference,
    amount: input.amount,
    currency: input.currency ?? 'COP',
    link_id: null,
    transaction_id: null,
    starts_at: null,
    expires_at: null,
    paid_at: null,
  });
}

export async function updateSubscriptionLinkId(id: string, linkId: string): Promise<void> {
  await updateOne<Subscription>('subscriptions', [{ column: 'id', value: id }], {
    link_id: linkId,
    updated_at: new Date().toISOString(),
  });
}

export async function activateSubscription(
  id: string,
  input: {
    starts_at: string;
    expires_at: string;
    paid_at: string;
    link_id?: string | null;
    transaction_id?: string | null;
  },
): Promise<Subscription> {
  return updateOne<Subscription>('subscriptions', [{ column: 'id', value: id }], {
    status: 'active',
    starts_at: input.starts_at,
    expires_at: input.expires_at,
    paid_at: input.paid_at,
    link_id: input.link_id ?? null,
    transaction_id: input.transaction_id ?? null,
    updated_at: new Date().toISOString(),
  });
}

export async function expireOtherActiveSubscriptions(
  userId: string,
  keepId: string,
): Promise<void> {
  const db = getMatuDb();
  const { data } = await db
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active');

  for (const row of data ?? []) {
    if (row.id !== keepId) {
      await updateOne<Subscription>('subscriptions', [{ column: 'id', value: row.id }], {
        status: 'expired',
        updated_at: new Date().toISOString(),
      });
    }
  }
}
