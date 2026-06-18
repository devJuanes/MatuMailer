'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { TopNav } from '@/components/layout/top-nav';
import { useMounted } from '@/hooks/use-mounted';
import { PlanProvider } from '@/providers/plan-provider';
import { PreloadBlock } from '@/lib/preload';
import { getToken } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const mounted = useMounted();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <PreloadBlock minHeight="min-h-screen" />
      </div>
    );
  }

  return (
    <PlanProvider>
      <div className="flex min-h-screen bg-cream" suppressHydrationWarning>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav onMenuClick={() => setSidebarOpen(true)} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-12 sm:px-6">
            {children}
          </main>
        </div>
      </div>
    </PlanProvider>
  );
}
