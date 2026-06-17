'use client';

import { Crown } from 'lucide-react';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { cn, formatCurrency } from '@/lib/utils';
import { usageRatio } from '@/lib/plan-limits-ui';

type PlanLimitBannerProps = {
  label: string;
  used: number;
  max: number;
  blocked?: boolean;
  description?: string;
  className?: string;
  /** Siempre visible en plan gratis (aunque no esté cerca del límite) */
  showUsage?: boolean;
};

export function PlanLimitBanner({
  label,
  used,
  max,
  blocked = false,
  description,
  className,
  showUsage = false,
}: PlanLimitBannerProps) {
  const pct = usageRatio(used, max);
  const atLimit = used >= max;

  if (!blocked && !atLimit && !showUsage && pct < 80) return null;

  return (
    <div
      className={cn(
        'mb-4 rounded-2xl border p-4',
        atLimit || blocked ? 'border-amber-300/80 bg-amber-50/90' : 'border-gold/30 bg-gold/10',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 shrink-0 text-gold" />
            <p className="text-sm font-semibold text-charcoal">
              {atLimit || blocked
                ? `${label}: límite alcanzado (${used}/${max})`
                : `${label}: ${used}/${max} usados`}
            </p>
          </div>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          {(atLimit || blocked) && (
            <p className="mt-1 text-sm text-amber-900">
              Plan gratis — actualiza a Premium desde {formatCurrency(25000, 'COP')}/mes para
              desbloquear más.
            </p>
          )}
          <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/80">
            <div
              className={cn('h-full rounded-full', atLimit ? 'bg-amber-500' : 'bg-gold')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {(atLimit || blocked) && <UpgradeButton />}
      </div>
    </div>
  );
}

type PlanFreeBadgeProps = {
  className?: string;
};

export function PlanFreeBadge({ className }: PlanFreeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-charcoal/8 px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      Plan gratis
    </span>
  );
}
