'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/button';
import { PreloadBlock } from '@/lib/preload';
import { clearSignupDraft, loadSignupDraft, signupConfirm } from '@/lib/billingApi';

export default function RegisterPaymentResultClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [confirming, setConfirming] = useState(true);
  const [paid, setPaid] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const reference = searchParams.get('reference') ?? '';
    const draft = loadSignupDraft();

    if (!reference) {
      setConfirming(false);
      setMessage('Referencia de pago no encontrada');
      return;
    }

    void (async () => {
      try {
        const result = await signupConfirm(reference);

        if (result.paid && result.accountCreated) {
          clearSignupDraft();
          if (result.token) {
            const { setToken } = await import('@/lib/api');
            setToken(result.token);
            setPaid(true);
            router.replace('/dashboard');
            return;
          }
          if (draft) {
            try {
              const { api, setToken } = await import('@/lib/api');
              const login = await api<{ token: string }>('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: draft.email, password: draft.password }),
                token: null,
              });
              setToken(login.token);
              setPaid(true);
              router.replace('/dashboard');
              return;
            } catch {
              /* manual login */
            }
          }
          setNeedsLogin(true);
          setMessage(
            `Cuenta Premium creada${result.email ? ` (${result.email})` : ''}. Inicia sesión para continuar.`,
          );
          return;
        }

        if (result.alreadyCompleted) {
          clearSignupDraft();
          setNeedsLogin(true);
          setMessage('Tu cuenta ya está activa. Inicia sesión con tu correo y contraseña.');
          return;
        }

        setMessage(
          `Pago no confirmado (${result.status ?? 'pendiente'}). Si ya pagaste, espera un momento e intenta de nuevo.`,
        );
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'No se pudo completar el registro');
      } finally {
        setConfirming(false);
      }
    })();
  }, [searchParams, router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-cream p-6">
      <AppLogo size="md" />
      <div className="mt-6 w-full max-w-md glass-card p-8 text-center">
        {confirming && <PreloadBlock minHeight="min-h-[8rem]" />}

        {!confirming && paid && (
          <div className="space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-gold" />
            <h1 className="text-xl font-bold text-charcoal">¡Bienvenido!</h1>
          </div>
        )}

        {!confirming && needsLogin && (
          <div className="space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-gold" />
            <h1 className="text-xl font-bold text-charcoal">¡Cuenta lista!</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button asChild className="w-full">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </div>
        )}

        {!confirming && !paid && !needsLogin && (
          <div className="space-y-4">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="text-lg font-bold text-charcoal">No se pudo completar</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button variant="gold" asChild className="w-full">
              <Link href="/register?tier=premium">Volver al registro</Link>
            </Button>
            <Link href="/login" className="block text-xs font-medium text-charcoal hover:underline">
              Iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
