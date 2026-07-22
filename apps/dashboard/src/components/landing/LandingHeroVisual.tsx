import { Mail } from 'lucide-react';
import { AppLogo } from '@/components/brand/AppLogo';
import { APP } from '@/lib/brand';

/** Plano visual del hero: inbox / envíos en movimiento (sin cards). */
export function LandingHeroVisual() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-lg lg:max-w-none" aria-hidden>
      <div className="landing-pulse-ring absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/50" />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-gold/40 via-amber-200/30 to-transparent blur-2xl" />

      <div className="landing-float absolute left-[8%] top-[18%] w-[58%] rotate-[-8deg] rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_20px_50px_-20px_rgba(28,25,23,0.35)] backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/40">
            <Mail className="h-4 w-4 text-charcoal" />
          </span>
          <div>
            <p className="text-xs font-semibold text-charcoal">welcome · plantilla</p>
            <p className="text-[10px] text-muted-foreground">Enviado hace 2s</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-[80%] rounded-full bg-charcoal/10" />
          <div className="h-2 w-[60%] rounded-full bg-charcoal/10" />
          <div className="h-2 w-[66%] rounded-full bg-gold/50" />
        </div>
      </div>

      <div className="landing-float-slow absolute bottom-[12%] right-[4%] w-[52%] rotate-[6deg] rounded-2xl border border-charcoal/20 bg-charcoal p-4 text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold">Campaña grupo</p>
        <p className="mt-1 text-sm font-semibold">Clientes VIP · 128 contactos</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-[72%] rounded-full bg-gold" />
        </div>
        <p className="mt-2 text-[11px] text-white/60">72% enviados · cola durable</p>
      </div>

      <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-soft-lg backdrop-blur-md">
          <AppLogo size="lg" priority />
        </div>
        <p className="mt-3 text-center text-sm font-bold tracking-tight text-charcoal drop-shadow-sm">
          {APP.name}
        </p>
      </div>
    </div>
  );
}
