'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { confirmPayment } from '@/lib/billingApi';

export default function PremiumPaymentResultClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [confirming, setConfirming] = useState(true);
  const [paid, setPaid] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const reference = searchParams.get('reference') ?? '';

    if (!reference) {
      setConfirming(false);
      setMessage('Referencia de pago no encontrada');
      return;
    }

    void (async () => {
      try {
        const result = await confirmPayment(reference);
        if (result.paid) {
          setPaid(true);
          setTimeout(() => router.replace('/dashboard/premium'), 1800);
          return;
        }
        setMessage(
          `Pago no confirmado (${result.status ?? 'pendiente'}). Si ya pagaste, espera un momento e intenta de nuevo.`,
        );
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'No se pudo confirmar el pago');
      } finally {
        setConfirming(false);
      }
    })();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="glass-card w-full max-w-md p-8 text-center">
        {confirming && (
          <div className="space-y-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-gold" />
            <h1 className="text-xl font-bold text-charcoal">Confirmando pago…</h1>
            <p className="text-sm text-muted-foreground">Activando tu plan Premium</p>
          </div>
        )}

        {!confirming && paid && (
          <div className="space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-gold" />
            <h1 className="text-2xl font-bold text-charcoal">¡Pago confirmado!</h1>
            <p className="text-sm text-muted-foreground">Redirigiendo…</p>
          </div>
        )}

        {!confirming && !paid && (
          <div className="space-y-4">
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h1 className="text-xl font-bold text-charcoal">Pago pendiente</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link href="/dashboard/premium">
              <Button className="w-full">Volver a Premium</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
