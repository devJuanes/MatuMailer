import type { Metadata } from 'next';
import Link from 'next/link';
import { Fraunces, Outfit } from 'next/font/google';
import { ArrowRight, CheckCircle2, Crown, Zap } from 'lucide-react';
import { LandingCta } from '@/components/landing/LandingCta';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingFeatureBanner } from '@/components/landing/LandingFeatureBanner';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHeroVisual } from '@/components/landing/LandingHeroVisual';
import { LandingMarquee } from '@/components/landing/LandingMarquee';
import { LandingPromoBanner } from '@/components/landing/LandingPromoBanner';
import { LandingSection } from '@/components/landing/LandingSection';
import {
  HERO_STATS,
  LANDING_FEATURES,
  LANDING_STEPS,
  TRUST_SIGNALS,
  USE_CASES,
} from '@/components/landing/content';
import { Button } from '@/components/ui/button';
import { SafeDiv } from '@/components/ui/safe-div';
import { FREE_PLAN_FEATURES, MONTHLY_PRICE, PREMIUM_PLAN_FEATURES } from '@/constants/plans';
import { APP, MATUBYTE } from '@/lib/brand';
import { buildLandingJsonLd, buildLandingMetadata } from '@/lib/seo';
import { cn } from '@/lib/utils';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-landing-display',
  weight: ['600', '700'],
});

const sans = Outfit({
  subsets: ['latin'],
  variable: '--font-landing-sans',
  weight: ['400', '500', '600', '700'],
});

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

      <SafeDiv
        className={cn(
          display.variable,
          sans.variable,
          'relative min-h-screen overflow-hidden bg-cream font-[family-name:var(--font-landing-sans)]',
        )}
      >
        <SafeDiv className="landing-hero-glow pointer-events-none absolute inset-0" />
        <SafeDiv className="landing-grid pointer-events-none absolute inset-0 opacity-35" />

        <LandingPromoBanner />
        <LandingHeader />

        <main className="relative z-10">
          {/* Hero — una composición: marca + headline + CTA + visual */}
          <section className="relative overflow-hidden">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:grid-cols-2 lg:gap-12 lg:pb-24">
              <div className="landing-fade-up">
                <p
                  className="font-[family-name:var(--font-landing-display)] text-5xl font-bold leading-none tracking-tight text-charcoal sm:text-6xl lg:text-7xl"
                  style={{ letterSpacing: '-0.03em' }}
                >
                  {APP.name}
                </p>
                <h1 className="mt-5 max-w-xl text-2xl font-semibold leading-snug tracking-tight text-charcoal/90 sm:text-3xl">
                  Correo transaccional sin montar infraestructura
                </h1>
                <p className="landing-fade-up landing-fade-up-delay-1 mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Dominios verificados, aliases, plantillas y un SDK npm. Un token y listo — por{' '}
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

                <div className="landing-fade-up landing-fade-up-delay-2 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button size="lg" variant="gold" asChild>
                    <Link href="/register">
                      Crear cuenta gratis <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="secondary" asChild>
                    <Link href="/#como-funciona">Ver cómo funciona</Link>
                  </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Sin tarjeta · Configura en minutos · Soporte en español
                </p>
              </div>

              <div className="landing-fade-up landing-fade-up-delay-1">
                <LandingHeroVisual />
              </div>
            </div>
          </section>

          <LandingMarquee />

          {/* Trust + stats (fuera del primer viewport) */}
          <section
            aria-label="Señales de confianza"
            className="border-b border-white/60 bg-white/50"
          >
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6">
              {TRUST_SIGNALS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="font-semibold text-charcoal">{s.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                </div>
              ))}
            </div>
            <dl className="mx-auto grid max-w-6xl grid-cols-3 gap-4 border-t border-charcoal/5 px-4 py-8 sm:px-6">
              {HERO_STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <dt className="font-[family-name:var(--font-landing-display)] text-2xl font-bold text-charcoal sm:text-3xl">
                    {s.value}
                  </dt>
                  <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {/* Code showcase */}
            <LandingSection
              id="sdk"
              title="Integración en cuatro líneas"
              subtitle="El mismo SDK que usan tus plantillas del dashboard. Copia, pega y envía."
            >
              <div className="glass-card overflow-hidden text-left">
                <div className="flex items-center gap-2 border-b border-border/50 bg-charcoal/5 px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/40">
                    <Zap className="h-4 w-4 text-charcoal" />
                  </div>
                  <span className="text-sm font-semibold text-charcoal">matumailer · npm</span>
                </div>
                <pre className="overflow-x-auto bg-charcoal p-5 font-mono text-sm leading-relaxed text-gold/90 sm:p-8">
                  <code>{`import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN,
});

await mail.sendTemplate('usuario@empresa.com', 'welcome', {
  nombre: 'Juan',
  enlace: 'https://tuapp.com/start',
});`}</code>
                </pre>
              </div>
            </LandingSection>

            <LandingFeatureBanner
              className="mb-4"
              tone="dark"
              icon="groups"
              eyebrow="Mensajería"
              title="Plantillas, contactos y grupos como tu flujo diario"
              description="Organiza destinatarios, lanza campañas a un grupo completo y programa envíos que sobreviven reinicios."
              href="/register"
              cta="Empezar ahora"
            />

            {/* Features */}
            <LandingSection
              id="funciones"
              title="Todo lo que necesitas para enviar correo"
              subtitle="Desde dominios verificados hasta analíticas — una plataforma pensada para developers."
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {LANDING_FEATURES.map((f) => (
                  <article
                    key={f.title}
                    className="group glass-card p-6 text-left transition-transform duration-300 hover:-translate-y-1"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold transition-transform group-hover:scale-105">
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

            <LandingFeatureBanner
              className="my-2"
              tone="gold"
              icon="crown"
              eyebrow="Premium"
              title="Masivos, programados y sin límites de proyecto"
              description={`Desde ${formatCop(MONTHLY_PRICE)}/mes. Ideal cuando tu producto ya envía correo de verdad.`}
              href="/register?tier=premium"
              cta="Probar Premium"
            />

            {/* How it works */}
            <LandingSection
              id="como-funciona"
              title="Cómo funciona"
              subtitle="De cero a tu primer correo transaccional en tres pasos."
            >
              <ol className="grid gap-6 md:grid-cols-3">
                {LANDING_STEPS.map((step) => (
                  <li key={step.n} className="glass-card relative overflow-hidden p-6 text-left">
                    <span className="absolute -right-2 -top-4 font-[family-name:var(--font-landing-display)] text-7xl font-bold text-gold/25">
                      {step.n}
                    </span>
                    <span className="relative text-sm font-bold text-gold">{step.n}</span>
                    <h3 className="relative mt-3 text-lg font-semibold text-charcoal">
                      {step.title}
                    </h3>
                    <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
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
              subtitle="SaaS, e-commerce, apps internas y startups que necesitan correo confiable."
            >
              <div className="grid gap-6 sm:grid-cols-2">
                {USE_CASES.map((u) => (
                  <article
                    key={u.title}
                    className="flex gap-4 rounded-2xl border border-white/70 bg-white/60 p-6 transition-colors hover:border-gold/40 hover:bg-white/90"
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

            <LandingFeatureBanner
              className="mb-8"
              tone="cream"
              icon="mail"
              eyebrow="Tracking"
              title="Sabes si lo abrieron y si hicieron clic"
              description="Pixel de apertura, links trackeados y logs con mensajes claros cuando algo falla."
              href="/register"
              cta="Activar seguimiento"
            />

            {/* Pricing */}
            <LandingSection
              id="precios"
              title="Planes simples y transparentes"
              subtitle="Empieza gratis. Escala a Premium cuando necesites masivo y programación."
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

            <LandingSection
              id="faq"
              title="Preguntas frecuentes"
              subtitle="Respuestas claras sobre MatuMailer, planes e integración."
            >
              <LandingFaq />
            </LandingSection>

            <div className="pb-20 pt-4">
              <LandingCta />
            </div>
          </div>
        </main>

        <LandingFooter />
      </SafeDiv>
    </>
  );
}
