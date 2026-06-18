import { Suspense } from 'react';
import RegisterPaymentResultClient from './RegisterPaymentResultClient';

export default function RegisterPaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPaymentResultClient />
    </Suspense>
  );
}
