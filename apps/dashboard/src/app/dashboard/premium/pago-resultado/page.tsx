import { Suspense } from 'react';
import PremiumPaymentResultClient from './PremiumPaymentResultClient';

export default function PremiumPaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          Cargando…
        </div>
      }
    >
      <PremiumPaymentResultClient />
    </Suspense>
  );
}
