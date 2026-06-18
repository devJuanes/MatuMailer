import { randomBytes } from 'crypto';
import { PLAN_BY_ID, type SubscriptionPlanId } from '@matumailer/shared';
import {
  MatuAuthError,
  matuSignUp,
  pendingSignupsRepo,
  subscriptionsRepo,
  syncAppUser,
  usersRepo,
} from '@matumailer/database';
import { decrypt, encrypt } from '../lib/crypto.js';
import {
  createPaymentLink,
  getAppUrl,
  getPaymentStatus,
  isPaymentPaid,
  type PaymatuCheckout,
} from './paymatu.service.js';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function isEmailTaken(email: string): Promise<boolean> {
  const user = await usersRepo.findUserByEmail(email.toLowerCase());
  if (user) return true;
  const completed = await pendingSignupsRepo.findCompletedPendingByEmail(email);
  return !!completed;
}

export async function createSignupCheckout(input: {
  name: string;
  email: string;
  password: string;
  planId: SubscriptionPlanId;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const plan = PLAN_BY_ID[input.planId];

  if (!name || !email || input.password.length < 8 || !plan) {
    throw Object.assign(
      new Error('Nombre, correo, contraseña (mín. 8) y plan válido son requeridos'),
      {
        statusCode: 400,
      },
    );
  }

  if (await isEmailTaken(email)) {
    throw Object.assign(new Error('Este correo ya está registrado'), { statusCode: 409 });
  }

  const reference = `MAILER-SIGNUP-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const returnUrl = `${getAppUrl()}/register/pago-resultado`;

  const pending = await pendingSignupsRepo.createPendingSignup({
    email,
    name,
    password_enc: encrypt(input.password),
    plan_id: plan.id,
    payment_reference: reference,
  });

  try {
    const checkout = await createPaymentLink({
      productId: plan.id,
      reference,
      license: email,
      description: `${plan.name} — ${name}`,
      returnUrl,
    });

    if (checkout.link_id) {
      await pendingSignupsRepo.updatePendingSignupLinkId(pending.id, checkout.link_id);
    }

    return {
      checkoutUrl: checkout.url,
      reference: checkout.reference ?? reference,
      amount: checkout.amount ?? plan.amount,
      currency: checkout.currency ?? 'COP',
    };
  } catch (err) {
    await pendingSignupsRepo.deletePendingSignupByReference(reference);
    throw err;
  }
}

async function activatePremiumForUser(
  userId: string,
  planId: SubscriptionPlanId,
  reference: string,
  payment: PaymatuCheckout,
) {
  const plan = PLAN_BY_ID[planId];
  if (!plan) throw new Error('Plan desconocido');

  const existing = await subscriptionsRepo.findSubscriptionByReference(reference);
  if (existing?.status === 'active') return existing;

  const now = new Date();
  const expiresAt = addMonths(now, plan.months);
  const paidAt = now.toISOString();

  const pendingSub = await subscriptionsRepo.createPendingSubscription({
    user_id: userId,
    plan_id: plan.id,
    payment_reference: reference,
    amount: plan.amount,
  });

  await subscriptionsRepo.expireOtherActiveSubscriptions(userId, pendingSub.id);
  return subscriptionsRepo.activateSubscription(pendingSub.id, {
    starts_at: paidAt,
    expires_at: expiresAt.toISOString(),
    paid_at: paidAt,
    link_id: payment.link_id ?? payment.id ?? null,
    transaction_id: payment.transaction_id ?? null,
  });
}

export async function confirmSignupPayment(reference: string) {
  const pending = await pendingSignupsRepo.findPendingSignupByReference(reference);
  if (!pending) {
    throw Object.assign(new Error('Registro no encontrado'), { statusCode: 404 });
  }

  if (pending.status === 'completed' && pending.user_id) {
    return {
      paid: true,
      accountCreated: true,
      email: pending.email,
      alreadyCompleted: true,
    };
  }

  const payment = await getPaymentStatus(reference);
  const status = String(payment.status ?? '').toUpperCase();
  const paid = isPaymentPaid(payment);

  if (!paid) {
    return { paid: false, status, accountCreated: false };
  }

  if (pending.status !== 'completed') {
    await pendingSignupsRepo.updatePendingSignupStatus(pending.id, 'paid');
  }

  const password = decrypt(pending.password_enc);
  const { user: authUser, token } = await matuSignUp(pending.email, password, pending.name);
  const user = await syncAppUser(authUser, { name: pending.name });

  await activatePremiumForUser(user.id, pending.plan_id, reference, payment);

  const paidAt = new Date().toISOString();
  await pendingSignupsRepo.updatePendingSignupStatus(pending.id, 'completed', {
    user_id: user.id,
    completed_at: paidAt,
  });

  return {
    paid: true,
    status,
    accountCreated: true,
    email: pending.email,
    token,
  };
}

export async function safeConfirmSignupPayment(reference: string) {
  try {
    return await confirmSignupPayment(reference);
  } catch (err) {
    if (err instanceof MatuAuthError) {
      throw Object.assign(new Error(err.message), {
        statusCode: err.statusCode >= 500 ? 502 : 400,
      });
    }
    throw err;
  }
}
