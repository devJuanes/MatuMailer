import type { Metadata } from 'next';
import { APP } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Iniciar sesión — ${APP.fullName}`,
  description: `Accede a tu dashboard de ${APP.fullName}. SMTP, plantillas y envío de correos para desarrolladores.`,
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
