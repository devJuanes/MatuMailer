'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';

export function LandingPromoBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="relative z-[60] overflow-hidden bg-charcoal text-white">
      <div
        className="landing-shimmer pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(105deg, transparent 40%, hsl(46 100% 64% / 0.35) 50%, transparent 60%)',
        }}
      />
      <div className="relative mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2.5 text-center text-sm sm:px-6">
        <Sparkles className="hidden h-4 w-4 shrink-0 text-gold sm:block" aria-hidden />
        <p className="font-medium leading-snug">
          Nuevo: <span className="text-gold">contactos, grupos y seguimiento</span> de aperturas —
          mensajería lista para producción.
        </p>
        <Link
          href="/register"
          className="hidden items-center gap-1 whitespace-nowrap font-semibold text-gold underline-offset-2 hover:underline sm:inline-flex"
        >
          Probar gratis <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          aria-label="Cerrar anuncio"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white sm:right-4"
          onClick={() => setVisible(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
