import type { Metadata } from 'next';
import { APP } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Crear cuenta — ${APP.fullName}`,
  description: `Regístrate gratis en ${APP.fullName}. SMTP, plantillas, SDK npm y correos de prueba sin tarjeta.`,
  robots: { index: false, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
