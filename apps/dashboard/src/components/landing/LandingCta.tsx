import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/brand';

type LandingCtaProps = {
  title?: string;
  subtitle?: string;
};

export function LandingCta({
  title = 'Tu próximo correo sale desde MatuMailer',
  subtitle = 'Cuenta gratis, SMTP en minutos, plantillas con variables y SDK listo para producción.',
}: LandingCtaProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-charcoal px-6 py-16 text-center sm:px-10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/25 via-transparent to-amber-900/20" />
      <div
        className="landing-shimmer pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(110deg, transparent 35%, hsl(46 100% 64% / 0.4) 50%, transparent 65%)',
        }}
      />
      <div className="landing-pulse-ring absolute left-[12%] top-[30%] h-24 w-24 rounded-full border border-gold/40" />
      <div className="landing-pulse-ring absolute bottom-[20%] right-[15%] h-16 w-16 rounded-full border border-gold/30 [animation-delay:1s]" />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Empieza hoy</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">{subtitle}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button size="lg" variant="gold" asChild>
            <Link href="/register">
              Crear cuenta gratis <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            asChild
          >
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Hablar por WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
