'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { AuthFooterLinks, AuthLayout } from '@/components/auth/AuthLayout';
import {
  AuthAlert,
  AuthSubmitButton,
  PasswordInput,
  inputCompact,
} from '@/components/auth/auth-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const { api, setToken } = await import('@/lib/api');
      const res = await api<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
        token: null,
      });
      setToken(res.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout variant="login" title="Iniciar sesión" subtitle="MatuDB Auth · acceso seguro">
      <form onSubmit={handleSubmit} className="space-y-3">
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

        <PasswordInput
          id="password"
          name="password"
          label="Contraseña"
          required
          autoComplete="current-password"
        />

        {error && <AuthAlert variant="error">{error}</AuthAlert>}

        <AuthSubmitButton loading={loading}>Iniciar sesión</AuthSubmitButton>
      </form>

      <AuthFooterLinks prompt="¿Sin cuenta?" linkHref="/register" linkLabel="Crear cuenta" />
    </AuthLayout>
  );
}
