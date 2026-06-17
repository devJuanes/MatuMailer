'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@/constants/plans';

type PlanPickerProps = {
  selected: SubscriptionPlanId;
  onSelect: (id: SubscriptionPlanId) => void;
  className?: string;
};

export function PlanPicker({ selected, onSelect, className }: PlanPickerProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {SUBSCRIPTION_PLANS.map((plan) => (
        <button
          key={plan.id}
          type="button"
          onClick={() => onSelect(plan.id)}
          className={cn(
            'w-full rounded-2xl border-2 p-4 text-left transition-all',
            selected === plan.id
              ? 'border-gold bg-gold/10 ring-2 ring-gold/30'
              : 'border-white/70 bg-white/60 hover:border-gold/40',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-charcoal">{plan.name}</p>
                {plan.badge && (
                  <span className="rounded-full bg-gold/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {plan.months === 1
                  ? '1 mes'
                  : `${formatCurrency(Math.round(plan.amount / plan.months), 'COP')}/mes · ${plan.months} meses`}
              </p>
              {plan.savings && <p className="mt-1 text-xs text-charcoal/70">{plan.savings}</p>}
            </div>
            <p className="shrink-0 text-lg font-bold text-charcoal">
              {formatCurrency(plan.amount, 'COP')}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
