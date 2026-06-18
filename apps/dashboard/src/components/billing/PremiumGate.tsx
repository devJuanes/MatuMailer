'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PreloadBlock } from '@/lib/preload';
import { usePlan } from '@/providers/plan-provider';

type PremiumGateProps = {
  feature: string;
  children: React.ReactNode;
};

export function PremiumGate({ feature, children }: PremiumGateProps) {
  const { isPremium, loading } = usePlan();

  if (loading) return <PreloadBlock minHeight="min-h-[16rem]" />;
  if (isPremium) return <>{children}</>;

  return (
    <div className="glass-card mx-auto max-w-lg p-8 text-center">
      <Crown className="mx-auto mb-4 h-12 w-12 text-gold" />
      <h2 className="text-xl font-bold text-charcoal">Función Premium</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {feature} está disponible solo en MatuMailer Premium.
      </p>
      <Link href="/dashboard/premium" className="mt-6 inline-block">
        <Button>
          <Crown className="mr-2 h-4 w-4" />
          Ver planes Premium
        </Button>
      </Link>
    </div>
  );
}
