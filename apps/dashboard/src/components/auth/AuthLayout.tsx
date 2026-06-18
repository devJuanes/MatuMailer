import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Code2, Mail, Server } from 'lucide-react';
import { AppLogo } from '@/components/brand/AppLogo';
import { APP, MATUBYTE } from '@/lib/brand';

const HIGHLIGHTS = [
  { icon: Server, text: 'SMTP automático' },
  { icon: Mail, text: 'Plantillas dinámicas' },
  { icon: Code2, text: 'SDK npm + API' },
] as const;

type AuthLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  variant?: 'login' | 'register';
  footer?: React.ReactNode;
};

export function AuthLayout({
  children,
  title,
  subtitle,
  variant = 'login',
  footer,
}: AuthLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-cream lg:flex-row">
      <aside className="relative hidden w-[46%] flex-col bg-charcoal text-white xl:w-[50%] lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/20 via-charcoal to-amber-950/40" />
        <div className="relative z-10 flex h-full flex-col p-8 xl:p-10">
          <Link href="/">
            <AppLogo size="sm" priority />
          </Link>

          <div className="flex flex-1 flex-col justify-center py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              {variant === 'login' ? 'Acceso seguro' : 'Nueva cuenta'}
            </p>
            <h1 className="mt-3 max-w-md text-2xl font-bold leading-tight xl:text-3xl">
              {variant === 'login'
                ? 'Infraestructura de correo lista para producción'
                : 'Elige gratis o Premium y empieza hoy'}
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
              {APP.description}. Desarrollado por {MATUBYTE.name}.
            </p>

            <ul className="mt-6 space-y-2">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm text-slate-300">
                  <Icon className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-2">
              {['MatuDB Auth', 'Credenciales cifradas', 'Soporte en español'].map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400"
                >
                  <CheckCircle2 className="h-3 w-3 text-gold" aria-hidden />
                  {h}
                </span>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            <a
              href={MATUBYTE.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-400 hover:text-gold"
            >
              {MATUBYTE.name}
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </p>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-4 lg:hidden">
              <Link href="/">
                <AppLogo size="xs" />
              </Link>
            </div>

            <div className="glass-card p-5 sm:p-6">
              <h2 className="text-xl font-bold text-charcoal">{title}</h2>
              {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
              <div className="mt-4">{children}</div>
            </div>

            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthFooterLinks({
  prompt,
  linkHref,
  linkLabel,
}: {
  prompt: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <p className="mt-4 text-center text-xs text-muted-foreground">
      {prompt}{' '}
      <Link href={linkHref} className="font-semibold text-charcoal hover:text-gold-dark">
        {linkLabel}
      </Link>
    </p>
  );
}
