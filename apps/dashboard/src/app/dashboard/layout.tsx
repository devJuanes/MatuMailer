'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/layout/top-nav';
import { getToken } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-cream">
      <TopNav />
      <main className="mx-auto max-w-[1400px] px-6 pb-12">{children}</main>
    </div>
  );
}
