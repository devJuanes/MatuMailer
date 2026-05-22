import Link from 'next/link';
import { ArrowRight, Mail, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-gradient-to-br from-gold/15 via-transparent to-amber-50/30" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-2 shadow-soft backdrop-blur-md">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold font-bold text-charcoal">
            M
          </div>
          <span className="text-lg font-semibold text-charcoal">MatuMailer</span>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button variant="default" asChild>
            <Link href="/register">Comenzar gratis</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-5 py-2 text-sm font-medium text-muted-foreground shadow-soft backdrop-blur-md">
          <Zap className="h-4 w-4 text-gold" />
          Infraestructura de correo para desarrolladores
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-charcoal sm:text-6xl lg:text-7xl">
          Envía correos
          <span className="mt-2 block text-gold-dark">sin complicaciones</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground">
          SMTP automático, plantillas dinámicas y autenticación MatuDB. Un token de API y listo.
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Button size="lg" variant="gold" asChild>
            <Link href="/register">
              Crear cuenta <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>

        <div className="mx-auto mt-16 max-w-3xl glass-card p-8 text-left">
          <pre className="font-mono text-sm leading-relaxed text-charcoal/75">
            <span className="font-semibold text-charcoal">import</span> {'{ MatuMailer }'}{' '}
            <span className="font-semibold text-charcoal">from</span>{' '}
            <span className="text-amber-700">&apos;matumailer&apos;</span>;
            {'\n\n'}
            <span className="font-semibold text-charcoal">await</span> mail.send({'{'}
            {'\n'}  template: <span className="text-amber-700">&apos;welcome&apos;</span>,{'\n'}
            {'  '}data: {'{'} name: <span className="text-amber-700">&apos;Juan&apos;</span> {'}'}
            {'\n}'});
          </pre>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Mail,
              title: 'SMTP automático',
              desc: 'Gmail, Outlook, Zoho — detección del proveedor',
            },
            {
              icon: Shield,
              title: 'Seguro',
              desc: 'MatuDB Auth y credenciales cifradas',
            },
            {
              icon: Zap,
              title: 'SDK + CLI',
              desc: 'Integración en minutos con npm',
            },
          ].map((f) => (
            <div key={f.title} className="glass-card p-8 text-left">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold">
                <f.icon className="h-6 w-6 text-charcoal" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
