'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { FREE_PLAN_FEATURES, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@/constants/plans';

export type RegisterTier = 'free' | 'premium';

type PlanTierSelectorProps = {
  tier: RegisterTier;
  onTierChange: (tier: RegisterTier) => void;
  planId: SubscriptionPlanId;
  onPlanChange: (id: SubscriptionPlanId) => void;
};

export function PlanTierSelector({
  tier,
  onTierChange,
  planId,
  onPlanChange,
}: PlanTierSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onTierChange('free')}
          className={cn(
            'rounded-xl border-2 px-3 py-2.5 text-left transition-all',
            tier === 'free'
              ? 'border-gold bg-gold/15 ring-1 ring-gold/30'
              : 'border-white/70 bg-white/50 hover:border-gold/30',
          )}
        >
          <p className="text-sm font-bold text-charcoal">Gratis</p>
          <p className="text-[11px] text-muted-foreground">$0 · límites básicos</p>
        </button>
        <button
          type="button"
          onClick={() => onTierChange('premium')}
          className={cn(
            'rounded-xl border-2 px-3 py-2.5 text-left transition-all',
            tier === 'premium'
              ? 'border-charcoal bg-charcoal text-white ring-1 ring-gold/40'
              : 'border-white/70 bg-white/50 hover:border-charcoal/20',
          )}
        >
          <p className="text-sm font-bold">Premium</p>
          <p
            className={cn(
              'text-[11px]',
              tier === 'premium' ? 'text-slate-300' : 'text-muted-foreground',
            )}
          >
            Desde {formatCurrency(25000, 'COP')}/mes
          </p>
        </button>
      </div>

      {tier === 'free' ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-white/50 px-3 py-2 text-[10px] text-muted-foreground">
          {FREE_PLAN_FEATURES.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => onPlanChange(plan.id)}
              className={cn(
                'shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition-all',
                planId === plan.id
                  ? 'border-gold bg-gold/20'
                  : 'border-white/70 bg-white/50 hover:border-gold/30',
              )}
            >
              <p className="text-[11px] font-bold text-charcoal">{plan.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatCurrency(plan.amount, 'COP')}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
