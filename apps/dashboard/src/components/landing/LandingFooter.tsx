import Link from 'next/link';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { AppLogo } from '@/components/brand/AppLogo';
import { SafeDiv } from '@/components/ui/safe-div';
import { APP, CONTACT, MATUBYTE, mailtoUrl, whatsappUrl } from '@/lib/brand';

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-white/70 bg-charcoal text-slate-300">
      <SafeDiv className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <section className="sm:col-span-2 lg:col-span-1">
          <AppLogo size="md" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">{APP.description}</p>
          <p className="mt-2 text-sm text-slate-400">{APP.tagline}</p>
          <p className="mt-4 text-xs text-slate-500">
            © {year} · Desarrollado por{' '}
            <a
              href={MATUBYTE.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 underline-offset-2 hover:text-white hover:underline"
            >
              {MATUBYTE.name}
            </a>
          </p>
        </section>

        <section aria-labelledby="footer-producto">
          <h3
            id="footer-producto"
            className="mb-4 text-sm font-semibold uppercase tracking-wider text-white"
          >
            Producto
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href="/#funciones" className="transition-colors hover:text-white">
                Funciones
              </Link>
            </li>
            <li>
              <Link href="/#como-funciona" className="transition-colors hover:text-white">
                Cómo funciona
              </Link>
            </li>
            <li>
              <Link href="/#precios" className="transition-colors hover:text-white">
                Precios
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="transition-colors hover:text-white">
                Preguntas frecuentes
              </Link>
            </li>
            <li>
              <Link href="/register" className="transition-colors hover:text-white">
                Crear cuenta
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition-colors hover:text-white">
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="footer-empresa">
          <h3
            id="footer-empresa"
            className="mb-4 text-sm font-semibold uppercase tracking-wider text-white"
          >
            Empresa
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <a
                href={MATUBYTE.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                {MATUBYTE.name}
              </a>
            </li>
            <li>
              <a
                href={MATUBYTE.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                matubyte.com
              </a>
            </li>
            <li className="text-slate-400">{MATUBYTE.tagline}</li>
          </ul>
        </section>

        <section aria-labelledby="footer-contacto">
          <h3
            id="footer-contacto"
            className="mb-4 text-sm font-semibold uppercase tracking-wider text-white"
          >
            Contacto
          </h3>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href={mailtoUrl(`Consulta sobre ${APP.fullName}`)}
                className="flex items-start gap-2.5 transition-colors hover:text-white"
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span className="break-all">{CONTACT.email}</span>
              </a>
            </li>
            <li>
              <a
                href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4 shrink-0 text-gold" />
                {CONTACT.phone}
              </a>
            </li>
            <li>
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 transition-colors hover:text-white"
              >
                <MessageCircle className="h-4 w-4 shrink-0 text-gold" />
                WhatsApp comercial
              </a>
            </li>
            <li className="flex items-start gap-2.5 text-slate-400">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>
                {MATUBYTE.city} · {CONTACT.hours}
              </span>
            </li>
          </ul>
        </section>
      </SafeDiv>
    </footer>
  );
}
