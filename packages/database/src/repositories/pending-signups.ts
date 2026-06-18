import type { SubscriptionPlanId } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { isMissingTableError } from '../db-errors';
import { insertOne, updateOne } from '../helpers';

export type PendingSignupStatus = 'pending' | 'paid' | 'completed';

export interface PendingSignup {
  id: string;
  email: string;
  name: string;
  password_enc: string;
  plan_id: SubscriptionPlanId;
  payment_reference: string;
  link_id: string | null;
  status: PendingSignupStatus;
  user_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export async function findPendingSignupByReference(
  reference: string,
): Promise<PendingSignup | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('pending_signups')
    .select('*')
    .eq('payment_reference', reference)
    .single();
  if (error || !data) return null;
  return data as PendingSignup;
}

export async function findCompletedPendingByEmail(email: string): Promise<PendingSignup | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('pending_signups')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('status', 'completed')
    .limit(1);
  if (error) {
    if (isMissingTableError(error, 'pending_signups')) return null;
    throw new Error(error.message);
  }
  return ((data ?? [])[0] as PendingSignup | undefined) ?? null;
}

export async function createPendingSignup(input: {
  email: string;
  name: string;
  password_enc: string;
  plan_id: SubscriptionPlanId;
  payment_reference: string;
}): Promise<PendingSignup> {
  return insertOne<PendingSignup>('pending_signups', {
    email: input.email.toLowerCase(),
    name: input.name,
    password_enc: input.password_enc,
    plan_id: input.plan_id,
    payment_reference: input.payment_reference,
    link_id: null,
    status: 'pending',
    user_id: null,
    completed_at: null,
  });
}

export async function updatePendingSignupLinkId(id: string, linkId: string): Promise<void> {
  await updateOne<PendingSignup>('pending_signups', [{ column: 'id', value: id }], {
    link_id: linkId,
  });
}

export async function updatePendingSignupStatus(
  id: string,
  status: PendingSignupStatus,
  extra?: { user_id?: string; completed_at?: string },
): Promise<void> {
  await updateOne<PendingSignup>('pending_signups', [{ column: 'id', value: id }], {
    status,
    ...extra,
  });
}

export async function deletePendingSignupByReference(reference: string): Promise<void> {
  const db = getMatuDb();
  await db.from('pending_signups').delete().eq('payment_reference', reference);
}
