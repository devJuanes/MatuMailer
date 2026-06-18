import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/brand';

type LandingCtaProps = {
  title?: string;
  subtitle?: string;
};

export function LandingCta({
  title = 'Empieza a enviar correos hoy',
  subtitle = 'Crea tu cuenta gratis, configura SMTP en minutos e integra con el SDK npm.',
}: LandingCtaProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-charcoal px-6 py-14 text-center sm:px-10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/20 via-transparent to-amber-900/10" />
      <div className="relative">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">{subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
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
