'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Mail, User } from 'lucide-react';
import { AuthFooterLinks, AuthLayout } from '@/components/auth/AuthLayout';
import {
  AuthAlert,
  AuthSubmitButton,
  PasswordInput,
  inputCompact,
} from '@/components/auth/auth-fields';
import { PlanTierSelector, type RegisterTier } from '@/components/auth/PlanTierSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SubscriptionPlanId } from '@/constants/plans';
import { saveSignupDraft, signupCheckout } from '@/lib/billingApi';

export default function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTier = useMemo<RegisterTier>(
    () => (searchParams.get('tier') === 'premium' ? 'premium' : 'free'),
    [searchParams],
  );

  const [tier, setTier] = useState<RegisterTier>(initialTier);
  const [planId, setPlanId] = useState<SubscriptionPlanId>('plan-semestral');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (!name || !email) {
      setError('Completa nombre y correo');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      if (tier === 'free') {
        const { api, setToken } = await import('@/lib/api');
        const res = await api<{ token: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
          token: null,
        });
        setToken(res.token);
        router.push('/dashboard');
        return;
      }

      saveSignupDraft({ name, email, password, planId });
      const { checkoutUrl } = await signupCheckout(name, email, password, planId);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      variant="register"
      title="Crear cuenta"
      subtitle={
        tier === 'free' ? 'Plan gratis · sin tarjeta' : 'Premium · pago seguro con PayMatuByte'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <PlanTierSelector
          tier={tier}
          onTierChange={setTier}
          planId={planId}
          onPlanChange={setPlanId}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs">
              Nombre
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                name="name"
                required
                autoComplete="name"
                placeholder="Juan"
                className={`${inputCompact} pl-9`}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs">
              Correo
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@empresa.com"
                className={`${inputCompact} pl-9`}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PasswordInput
            id="password"
            name="password"
            label="Contraseña"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <PasswordInput
            id="confirm"
            name="confirm"
            label="Confirmar"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && <AuthAlert variant="error">{error}</AuthAlert>}

        <AuthSubmitButton loading={loading} variant="gold">
          {tier === 'free' ? 'Crear cuenta gratis' : 'Continuar al pago'}
        </AuthSubmitButton>
      </form>

      <AuthFooterLinks prompt="¿Ya tienes cuenta?" linkHref="/login" linkLabel="Iniciar sesión" />
    </AuthLayout>
  );
}
