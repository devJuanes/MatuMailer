'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    const form = new FormData(e.currentTarget);
    try {
      const { api, setToken } = await import('@/lib/api');
      const res = await api<{ token: string; message?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        }),
        token: null,
      });
      setToken(res.token);
      if (res.message) setInfo(res.message);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-transparent" />
      <Card className="relative w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold font-bold text-xl text-charcoal">
            M
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>
            Registro con MatuDB Auth — verificación de correo incluida
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required placeholder="Juan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
            </div>
            {error && (
              <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
            )}
            {info && (
              <p className="rounded-2xl bg-gold/20 px-4 py-2 text-sm text-charcoal">{info}</p>
            )}
            <Button type="submit" className="w-full" variant="gold" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-charcoal hover:text-gold-dark">
              Iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
