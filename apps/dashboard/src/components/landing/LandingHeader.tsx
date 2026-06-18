'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, LogIn, Menu, UserPlus, X } from 'lucide-react';
import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/button';
import { APP } from '@/lib/brand';
import { cn } from '@/lib/utils';

const NAV: Array<{ href: string; label: string; external?: boolean }> = [
  { href: '/#funciones', label: 'Funciones' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/#precios', label: 'Precios' },
  { href: '/#faq', label: 'FAQ' },
  { href: 'https://matubyte.com', label: 'MatuByte', external: true },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-cream/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
          <AppLogo size="sm" priority />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-charcoal">{APP.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{APP.description}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm lg:flex">
          {NAV.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-charcoal"
              >
                {item.label}
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-charcoal"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </Link>
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link href="/register">
              <UserPlus className="h-4 w-4" />
              Comenzar gratis
            </Link>
          </Button>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/70 lg:hidden"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/60 bg-white/95 px-4 py-4 lg:hidden">
          <nav className="space-y-1">
            {NAV.map((item) =>
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/80 hover:text-charcoal"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/80 hover:text-charcoal',
                  )}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-white/60 pt-3">
            <Button variant="secondary" asChild>
              <Link href="/login" onClick={() => setOpen(false)}>
                Iniciar sesión
              </Link>
            </Button>
            <Button variant="gold" asChild>
              <Link href="/register" onClick={() => setOpen(false)}>
                Comenzar gratis
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
