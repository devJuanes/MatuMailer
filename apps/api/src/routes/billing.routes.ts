import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PLAN_BY_ID, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@matumailer/shared';
import { subscriptionsRepo, usersRepo } from '@matumailer/database';
import { z } from 'zod';
import { getPlanStatus } from '../services/plan.service.js';
import {
  createSignupCheckout,
  safeConfirmSignupPayment,
} from '../services/signup-billing.service.js';
import {
  createPaymentLink,
  getAppUrl,
  getPaymentStatus,
  isPaymatuConfigured,
  isPaymentPaid,
} from '../services/paymatu.service.js';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function billingRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get('/plans', { schema: { tags: ['Billing'] } }, async () => ({
    plans: SUBSCRIPTION_PLANS,
    monthlyPrice: SUBSCRIPTION_PLANS[0].amount,
  }));

  server.get(
    '/status',
    { preHandler: [app.authenticate], schema: { tags: ['Billing'] } },
    async (request) => getPlanStatus(request.userId!),
  );

  server.get(
    '/subscription',
    { preHandler: [app.authenticate], schema: { tags: ['Billing'] } },
    async (request) => {
      const history = await subscriptionsRepo.findSubscriptionsByUserId(request.userId!);
      const active = await subscriptionsRepo.findActiveSubscription(request.userId!);
      return { subscription: active, history };
    },
  );

  server.post(
    '/checkout',
    {
      preHandler: [app.authenticate],
      schema: {
        body: z.object({ planId: z.enum(['plan-mensual', 'plan-semestral', 'plan-anual']) }),
        tags: ['Billing'],
      },
    },
    async (request, reply) => {
      if (!isPaymatuConfigured()) {
        return reply
          .status(503)
          .send({ error: 'PAYMENTS_NOT_CONFIGURED', message: 'Pagos no configurados' });
      }

      const plan = PLAN_BY_ID[request.body.planId as SubscriptionPlanId];
      if (!plan) {
        return reply.status(400).send({ error: 'INVALID_PLAN', message: 'Plan no válido' });
      }

      const user = await usersRepo.findUserById(request.userId!);
      const reference = `MAILER-${String(request.userId).slice(0, 8)}-${Date.now()}`;
      const returnUrl = `${getAppUrl()}/dashboard/premium/pago-resultado`;

      const pending = await subscriptionsRepo.createPendingSubscription({
        user_id: request.userId!,
        plan_id: plan.id,
        payment_reference: reference,
        amount: plan.amount,
      });

      const checkout = await createPaymentLink({
        productId: plan.id,
        reference,
        license: request.userId!,
        description: `${plan.name} — ${user?.name ?? user?.email ?? 'MatuMailer'}`,
        returnUrl,
      });

      if (checkout.link_id) {
        await subscriptionsRepo.updateSubscriptionLinkId(pending.id, checkout.link_id);
      }

      return {
        checkoutUrl: checkout.url,
        reference: checkout.reference ?? reference,
        amount: checkout.amount ?? plan.amount,
        currency: checkout.currency ?? 'COP',
      };
    },
  );

  server.post(
    '/confirm',
    {
      preHandler: [app.authenticate],
      schema: {
        body: z.object({ reference: z.string().min(1) }),
        tags: ['Billing'],
      },
    },
    async (request, reply) => {
      if (!isPaymatuConfigured()) {
        return reply
          .status(503)
          .send({ error: 'PAYMENTS_NOT_CONFIGURED', message: 'Pagos no configurados' });
      }

      const { reference } = request.body;
      const row = await subscriptionsRepo.findSubscriptionByReference(reference);
      if (!row || row.user_id !== request.userId) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Suscripción no encontrada' });
      }

      if (row.status === 'active' && row.paid_at) {
        return { paid: true, status: 'active', subscription: row, alreadyActive: true };
      }

      const payment = await getPaymentStatus(reference);
      const status = String(payment.status ?? '').toUpperCase();
      const paid = isPaymentPaid(payment);

      if (!paid) {
        return { paid: false, status, subscription: row };
      }

      const plan = PLAN_BY_ID[row.plan_id as SubscriptionPlanId];
      if (!plan) {
        return reply.status(400).send({ error: 'INVALID_PLAN', message: 'Plan desconocido' });
      }

      const now = new Date();
      const active = await subscriptionsRepo.findActiveSubscription(request.userId!);
      let startsAt = now;
      if (active?.expires_at && new Date(active.expires_at) > now) {
        startsAt = new Date(active.expires_at);
      }

      const expiresAt = addMonths(startsAt, plan.months);
      const paidAt = now.toISOString();

      await subscriptionsRepo.expireOtherActiveSubscriptions(request.userId!, row.id);
      const subscription = await subscriptionsRepo.activateSubscription(row.id, {
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        paid_at: paidAt,
        link_id: payment.link_id ?? payment.id ?? row.link_id,
        transaction_id: payment.transaction_id ?? null,
      });

      return { paid: true, status, subscription };
    },
  );

  server.post(
    '/signup-checkout',
    {
      schema: {
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(8),
          planId: z.enum(['plan-mensual', 'plan-semestral', 'plan-anual']),
        }),
        tags: ['Billing'],
      },
    },
    async (request, reply) => {
      if (!isPaymatuConfigured()) {
        return reply
          .status(503)
          .send({ error: 'PAYMENTS_NOT_CONFIGURED', message: 'Pagos no configurados' });
      }

      try {
        return await createSignupCheckout(request.body);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
        const message = err instanceof Error ? err.message : 'Error al iniciar pago';
        return reply.status(statusCode).send({ error: 'SIGNUP_CHECKOUT_FAILED', message });
      }
    },
  );

  server.post(
    '/signup-confirm',
    {
      schema: {
        body: z.object({ reference: z.string().min(1) }),
        tags: ['Billing'],
      },
    },
    async (request, reply) => {
      if (!isPaymatuConfigured()) {
        return reply
          .status(503)
          .send({ error: 'PAYMENTS_NOT_CONFIGURED', message: 'Pagos no configurados' });
      }

      try {
        return await safeConfirmSignupPayment(request.body.reference);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
        const message = err instanceof Error ? err.message : 'Error al confirmar registro';
        return reply.status(statusCode).send({ error: 'SIGNUP_CONFIRM_FAILED', message });
      }
    },
  );
}
