import { Suspense } from 'react';
import { PreloadBlock } from '@/lib/preload';
import PremiumPaymentResultClient from './PremiumPaymentResultClient';

export default function PremiumPaymentResultPage() {
  return (
    <Suspense fallback={<PreloadBlock minHeight="min-h-[60vh]" />}>
      <PremiumPaymentResultClient />
    </Suspense>
  );
}
