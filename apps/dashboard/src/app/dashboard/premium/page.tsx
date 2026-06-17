'use client';

import Link from 'next/link';
import { Crown, Check } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PlanPicker } from '@/components/billing/PlanPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FREE_PLAN_FEATURES,
  PREMIUM_PLAN_FEATURES,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from '@/constants/plans';
import { usePlan } from '@/providers/plan-provider';
import { createCheckout } from '@/lib/billingApi';
import { formatCurrency } from '@/lib/utils';

export default function PremiumPage() {
  const { plan, isPremium, refresh } = usePlan();
  const [selected, setSelected] = useState<SubscriptionPlanId>('plan-semestral');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCheckout() {
    setLoading(true);
    setError('');
    try {
      const { checkoutUrl } = await createCheckout(selected);
      window.location.href = checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el pago');
      setLoading(false);
    }
  }

  const selectedPlan = SUBSCRIPTION_PLANS.find((p) => p.id === selected)!;

  return (
    <div>
      <PageHeader
        title="MatuMailer Premium"
        description="Desbloquea envíos masivos, programados y límites ampliados para tu operación de correo."
        showProject={false}
      />

      {isPremium && plan?.subscription && (
        <Card className="glass-card mb-8 border-gold/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-6">
            <Crown className="h-6 w-6 text-gold" />
            <div>
              <p className="font-semibold text-charcoal">Ya tienes Premium activo</p>
              {plan.subscription.expires_at && (
                <p className="text-sm text-muted-foreground">
                  Válido hasta {new Date(plan.subscription.expires_at).toLocaleDateString('es-CO')}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => refresh()}>
              Actualizar estado
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Plan Gratis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold text-charcoal">$0</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {FREE_PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-charcoal/50" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Sin envío masivo ni envíos programados.</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-gold/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-gold" /> Premium
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Desde {formatCurrency(25000, 'COP')}/mes
            </p>
            <ul className="space-y-2 text-sm text-charcoal">
              {PREMIUM_PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-gold" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {!isPremium && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="mb-4 text-xl font-bold text-charcoal">Elige tu plan</h2>
            <PlanPicker selected={selected} onSelect={setSelected} />
          </div>
          <Card className="glass-card h-fit">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold text-charcoal">{selectedPlan.name}</p>
                <p className="text-2xl font-bold text-charcoal">
                  {formatCurrency(selectedPlan.amount, 'COP')}
                </p>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="w-full" onClick={handleCheckout} disabled={loading}>
                {loading ? 'Redirigiendo a pago…' : 'Pagar con Bold'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Pagos seguros vía PayMatuByte (tarjeta, PSE, Nequi, Daviplata).
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {plan?.tier === 'free' && plan.limits && (
        <Card className="glass-card mt-8">
          <CardHeader>
            <CardTitle>Tu uso actual (plan gratis)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
            <UsageItem label="Proyectos" used={plan.usage.projects} max={plan.limits.maxProjects} />
            <UsageItem
              label="SMTP"
              used={plan.usage.smtpConfigs}
              max={plan.limits.maxSmtpConfigs}
            />
            <UsageItem
              label="Plantillas"
              used={plan.usage.customTemplates}
              max={plan.limits.maxCustomTemplates}
            />
            <UsageItem
              label="Pruebas"
              used={plan.usage.testEmails}
              max={plan.limits.maxTestEmails}
            />
            <UsageItem
              label={`Correos / ${plan.limits.emailWindowHours}h`}
              used={plan.usage.emailsInWindow}
              max={plan.limits.maxEmailsPerWindow}
            />
          </CardContent>
        </Card>
      )}

      {isPremium && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Quieres renovar antes?{' '}
          <button
            type="button"
            className="font-medium text-charcoal underline"
            onClick={handleCheckout}
          >
            Comprar otro periodo
          </button>
        </p>
      )}
    </div>
  );
}

function UsageItem({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="rounded-xl bg-white/50 p-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-charcoal">
        {used} / {max}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
