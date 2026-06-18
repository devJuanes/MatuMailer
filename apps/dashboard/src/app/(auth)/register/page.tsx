import { Suspense } from 'react';
import RegisterPageClient from './RegisterPageClient';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageClient />
    </Suspense>
  );
}
