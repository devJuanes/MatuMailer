'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UpgradeButtonProps = {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  label?: string;
};

export function UpgradeButton({
  size = 'sm',
  className,
  label = 'Actualizar a Premium',
}: UpgradeButtonProps) {
  return (
    <Link href="/dashboard/premium">
      <Button size={size} className={cn('gap-1.5', className)}>
        <Crown className="h-4 w-4" />
        {label}
      </Button>
    </Link>
  );
}
