export const MATUBYTE = {
  name: 'MatuByte S.A.S.',
  url: 'https://matubyte.com',
  tagline: 'Tecnología empresarial de alto impacto',
  city: 'Colombia',
  country: 'CO',
} as const;

function envString(key: string, fallback: string): string {
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export const CONTACT = {
  email: envString('NEXT_PUBLIC_CONTACT_EMAIL', 'contacto@matubyte.com'),
  phone: envString('NEXT_PUBLIC_CONTACT_PHONE', '+57 333 277 1764'),
  whatsapp: envString('NEXT_PUBLIC_CONTACT_WHATSAPP', '573332771764'),
  whatsappMessage: envString(
    'NEXT_PUBLIC_CONTACT_WHATSAPP_MSG',
    'Hola, me interesa conocer más sobre MatuMailer.',
  ),
  hours: 'Lunes a viernes · 8:00 a.m. – 6:00 p.m. (hora Colombia)',
} as const;

export function whatsappUrl(message = CONTACT.whatsappMessage) {
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function mailtoUrl(subject?: string) {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `mailto:${CONTACT.email}${q}`;
}

export const APP = {
  name: 'MatuMailer',
  fullName: 'MatuMailer',
  description: 'Infraestructura de correo para desarrolladores',
  tagline: 'SMTP, plantillas, SDK y entrega confiable para tu producto',
  logo: '/matumailer.png',
  favicon: '/matumailer.png',
  themeColor: '#f59e0b',
  docsUrl: '/dashboard/documentacion',
} as const;
