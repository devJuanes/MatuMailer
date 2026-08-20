'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Code2, Inbox } from 'lucide-react';
import { getToken } from '@/lib/api';
import { APP } from '@/lib/brand';

export default function HubPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c0c0e] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.18),_transparent_55%)]" />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium tracking-wide text-blue-400">{APP.name}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            ¿Cómo quieres trabajar hoy?
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Elige el modo. Puedes cambiar cuando quieras desde el menú.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard"
            className="group rounded-3xl border border-zinc-800 bg-[#141416] p-6 transition hover:border-blue-500/40 hover:bg-zinc-900"
          >
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
              <Code2 className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-white">Modo API</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Dominios, aliases, SDK, campañas y envío transaccional. Ideal para integrar MatuMailer
              en tu producto.
            </p>
            <span className="mt-5 inline-flex text-sm font-medium text-blue-400 group-hover:underline">
              Entrar al panel API →
            </span>
          </Link>

          <Link
            href="/mail"
            className="group rounded-3xl border border-zinc-800 bg-[#141416] p-6 transition hover:border-amber-500/40 hover:bg-zinc-900"
          >
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <Inbox className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-white">Modo Correo</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Bandeja de entrada de tus aliases verificados. Lee, responde y organiza los mensajes
              que llegan a tu dominio.
            </p>
            <span className="mt-5 inline-flex text-sm font-medium text-amber-400 group-hover:underline">
              Abrir bandeja →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
