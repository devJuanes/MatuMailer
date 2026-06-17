import { isPaidSubscriptionStatus } from '@matumailer/shared';

const PAYMATUBYTE_URL = (process.env.PAYMATUBYTE_URL ?? 'https://pay.matubyte.com').replace(
  /\/$/,
  '',
);
const PAYMATUBYTE_API_KEY = process.env.PAYMATUBYTE_API_KEY ?? '';
const PAYMATUBYTE_HOST = process.env.PAYMATUBYTE_HOST ?? '';

export function isPaymatuConfigured(): boolean {
  return !!PAYMATUBYTE_API_KEY;
}

export function getAppUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.CORS_ORIGIN?.split(',')[0] ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

async function paymatuFetch(path: string, options: { method?: string; body?: string } = {}) {
  if (!PAYMATUBYTE_API_KEY) {
    throw new Error('Servicio de pagos no configurado');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${PAYMATUBYTE_API_KEY}`,
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (PAYMATUBYTE_HOST) {
    headers.Host = PAYMATUBYTE_HOST;
  }

  const res = await fetch(`${PAYMATUBYTE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { message?: string; error?: string }).message ??
      (data as { message?: string; error?: string }).error ??
      res.statusText;
    throw new Error(msg || 'Error al contactar PayMatuByte');
  }
  return data;
}

export interface PaymatuCheckout {
  url: string;
  link_id?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  id?: string;
  transaction_id?: string;
  status?: string;
}

export function extractCheckout(payRes: unknown): PaymatuCheckout {
  const res = payRes as { data?: PaymatuCheckout; url?: string };
  const checkout = res.data ?? (res.url ? (payRes as PaymatuCheckout) : null);
  if (checkout?.url) return checkout;
  throw new Error('PayMatuByte no devolvió enlace de pago');
}

export async function createPaymentLink(input: {
  productId: string;
  reference: string;
  license: string;
  description: string;
  returnUrl: string;
}): Promise<PaymatuCheckout> {
  const payRes = await paymatuFetch('/v1/payment', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return extractCheckout(payRes);
}

export async function getPaymentStatus(reference: string): Promise<PaymatuCheckout> {
  const payRes = await paymatuFetch(`/v1/payments/${encodeURIComponent(reference)}`);
  const payment = (payRes as { data?: PaymatuCheckout }).data ?? (payRes as PaymatuCheckout);
  return payment;
}

export function isPaymentPaid(payment: PaymatuCheckout): boolean {
  return isPaidSubscriptionStatus(String(payment.status ?? ''));
}

export { paymatuFetch };
