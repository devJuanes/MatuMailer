import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Crown, Zap } from 'lucide-react';
import { LandingCta } from '@/components/landing/LandingCta';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingSection } from '@/components/landing/LandingSection';
import {
  HERO_STATS,
  LANDING_FEATURES,
  LANDING_STEPS,
  TRUST_SIGNALS,
  USE_CASES,
} from '@/components/landing/content';
import { Button } from '@/components/ui/button';
import { FREE_PLAN_FEATURES, MONTHLY_PRICE, PREMIUM_PLAN_FEATURES } from '@/constants/plans';
import { APP, MATUBYTE } from '@/lib/brand';
import { buildLandingJsonLd, buildLandingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildLandingMetadata();

function formatCop(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function HomePage() {
  const jsonLd = buildLandingJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="relative min-h-screen overflow-hidden bg-cream">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/15 via-transparent to-amber-50/30" />
        <div className="landing-grid pointer-events-none absolute inset-0 opacity-40" />

        <LandingHeader />

        <main className="relative z-10">
          {/* Hero */}
          <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:pb-24">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-charcoal sm:text-5xl lg:text-6xl">
                  Envía correos{' '}
                  <span className="text-transparent bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text">
                    sin complicaciones
                  </span>
                </h1>

                <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  {APP.fullName} conecta tu app con SMTP, plantillas dinámicas y un SDK npm. Un
                  token de API y listo — desarrollado por{' '}
                  <a
                    href={MATUBYTE.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-charcoal underline-offset-2 hover:underline"
                  >
                    {MATUBYTE.name}
                  </a>
                  .
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button size="lg" variant="gold" asChild>
                    <Link href="/register">
                      Crear cuenta gratis <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="secondary" asChild>
                    <Link href="/login">Iniciar sesión</Link>
                  </Button>
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  Sin tarjeta · Configura en minutos · Soporte en español
                </p>

                <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-white/60 pt-8">
                  {HERO_STATS.map((s) => (
                    <div key={s.label}>
                      <dt className="text-lg font-bold text-charcoal sm:text-xl">{s.value}</dt>
                      <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="glass-card p-6 sm:p-8">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/30">
                    <Zap className="h-4 w-4 text-charcoal" />
                  </div>
                  <span className="text-sm font-semibold text-charcoal">
                    Integración en 4 líneas
                  </span>
                </div>
                <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-charcoal/80">
                  <code>{`import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN,
});

await mail.send({
  template: 'welcome',
  to: 'usuario@empresa.com',
  data: { name: 'Juan' },
});`}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* Trust */}
          <section
            aria-label="Señales de confianza"
            className="border-y border-white/60 bg-white/40"
          >
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6">
              {TRUST_SIGNALS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="font-semibold text-charcoal">{s.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {/* Features */}
            <LandingSection
              id="funciones"
              title="Todo lo que necesitas para enviar correo"
              subtitle="Desde la configuración SMTP hasta analíticas de entrega — en una sola plataforma pensada para developers."
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {LANDING_FEATURES.map((f) => (
                  <article key={f.title} className="glass-card p-6 text-left">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold">
                      <f.icon className="h-6 w-6 text-charcoal" aria-hidden />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-charcoal">{f.title}</h3>
                      {'premium' in f && f.premium && (
                        <span className="rounded-full bg-charcoal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                          Premium
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </article>
                ))}
              </div>
            </LandingSection>

            {/* How it works */}
            <LandingSection
              id="como-funciona"
              title="Cómo funciona"
              subtitle="De cero a tu primer correo transaccional en tres pasos sencillos."
            >
              <ol className="grid gap-6 md:grid-cols-3">
                {LANDING_STEPS.map((step) => (
                  <li key={step.n} className="glass-card p-6 text-left">
                    <span className="text-3xl font-bold text-gold">{step.n}</span>
                    <h3 className="mt-3 text-lg font-semibold text-charcoal">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </li>
                ))}
              </ol>
            </LandingSection>

            {/* Use cases */}
            <LandingSection
              id="casos-de-uso"
              title="Casos de uso reales"
              subtitle="MatuMailer encaja en productos SaaS, e-commerce, apps internas y startups que necesitan correo confiable."
            >
              <div className="grid gap-6 sm:grid-cols-2">
                {USE_CASES.map((u) => (
                  <article
                    key={u.title}
                    className="flex gap-4 rounded-2xl border border-white/70 bg-white/60 p-6"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/30">
                      <u.icon className="h-5 w-5 text-charcoal" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-semibold text-charcoal">{u.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{u.desc}</p>
                    </div>
                  </article>
                ))}
              </div>
            </LandingSection>

            {/* Pricing */}
            <LandingSection
              id="precios"
              title="Planes simples y transparentes"
              subtitle="Empieza gratis. Escala a Premium cuando necesites envío masivo, programación y más proyectos."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <article className="glass-card p-8 text-left">
                  <h3 className="text-xl font-bold text-charcoal">Gratis</h3>
                  <p className="mt-2 text-3xl font-bold text-charcoal">
                    $0{' '}
                    <span className="text-base font-normal text-muted-foreground">/ siempre</span>
                  </p>
                  <ul className="mt-6 space-y-3">
                    {FREE_PLAN_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-8 w-full" variant="secondary" asChild>
                    <Link href="/register">Empezar gratis</Link>
                  </Button>
                  <Button className="mt-3 w-full" variant="gold" asChild>
                    <Link href="/register?tier=premium">Probar Premium</Link>
                  </Button>
                </article>

                <article className="relative glass-card border-gold/40 p-8 text-left ring-2 ring-gold/30">
                  <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1 text-xs font-bold text-gold">
                    <Crown className="h-3 w-3" aria-hidden />
                    Recomendado
                  </span>
                  <h3 className="text-xl font-bold text-charcoal">Premium</h3>
                  <p className="mt-2 text-3xl font-bold text-charcoal">
                    {formatCop(MONTHLY_PRICE)}{' '}
                    <span className="text-base font-normal text-muted-foreground">/ mes</span>
                  </p>
                  <ul className="mt-6 space-y-3">
                    {PREMIUM_PLAN_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-8 w-full" variant="gold" asChild>
                    <Link href="/register?tier=premium">Probar Premium</Link>
                  </Button>
                </article>
              </div>
            </LandingSection>

            {/* FAQ */}
            <LandingSection
              id="faq"
              title="Preguntas frecuentes"
              subtitle="Respuestas claras sobre MatuMailer, planes e integración."
            >
              <LandingFaq />
            </LandingSection>

            {/* CTA */}
            <div className="pb-20 pt-4">
              <LandingCta />
            </div>
          </div>
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
