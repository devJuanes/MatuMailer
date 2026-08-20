import type { Metadata } from 'next';
import { APP, CONTACT, MATUBYTE } from '@/lib/brand';

export function getSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  return typeof fromEnv === 'string' && fromEnv.trim()
    ? fromEnv.trim().replace(/\/$/, '')
    : 'https://mail.matucatalogo.com';
}

export const SEO_KEYWORDS = [
  'MatuMailer',
  'Matu Mailer',
  'MatuByte',
  'MatuByte S.A.S.',
  'envío de correos',
  'email transaccional',
  'API de correo',
  'dominio verificado',
  'infraestructura email',
  'plantillas de correo',
  'SDK email Node.js',
  'correo Colombia',
  'email LATAM',
  'MatuDB Auth',
  'mail.matucatalogo.com',
].join(', ');

export const LANDING_SEO = {
  title: `MatuMailer — Plataforma de correo transaccional para desarrolladores | ${MATUBYTE.name}`,
  description: `${APP.description}. Envía correos con dominios verificados, aliases, plantillas dinámicas, SDK npm y API REST. Plan gratis para empezar. Desarrollado por ${MATUBYTE.name} para equipos en Colombia y Latinoamérica.`,
  keywords: SEO_KEYWORDS,
} as const;

export function buildLandingMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const ogImage = `${siteUrl}${APP.logo}`;

  return {
    title: LANDING_SEO.title,
    description: LANDING_SEO.description,
    keywords: LANDING_SEO.keywords,
    authors: [{ name: MATUBYTE.name, url: MATUBYTE.url }],
    creator: MATUBYTE.name,
    publisher: MATUBYTE.name,
    category: 'technology',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: `${siteUrl}/`,
      languages: {
        'es-CO': `${siteUrl}/`,
        es: `${siteUrl}/`,
        'x-default': `${siteUrl}/`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'es_CO',
      alternateLocale: ['es_419'],
      url: `${siteUrl}/`,
      siteName: APP.fullName,
      title: LANDING_SEO.title,
      description: LANDING_SEO.description,
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: `${APP.fullName} — logo oficial`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: LANDING_SEO.title,
      description: LANDING_SEO.description,
      images: [ogImage],
    },
  };
}

export function buildLandingJsonLd() {
  const siteUrl = getSiteUrl();

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: MATUBYTE.name,
      url: MATUBYTE.url,
      email: CONTACT.email,
      telephone: CONTACT.phone,
      areaServed: ['CO', 'MX', 'CL', 'PE', 'AR', 'EC', 'VE', 'LATAM'],
      address: {
        '@type': 'PostalAddress',
        addressCountry: MATUBYTE.country,
        addressLocality: MATUBYTE.city,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: APP.fullName,
      alternateName: ['Matu Mailer', APP.name],
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web, Node.js',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'COP',
        description: 'Plan gratuito con dominio verificado, plantillas y correos de prueba',
      },
      description: LANDING_SEO.description,
      url: siteUrl,
      inLanguage: 'es-CO',
      featureList: [
        'Dominios verificados por DNS y aliases de envío',
        'Plantillas HTML dinámicas',
        'SDK npm y API REST',
        'Autenticación MatuDB',
        'Envío masivo y programado (Premium)',
      ],
      provider: {
        '@type': 'Organization',
        name: MATUBYTE.name,
        url: MATUBYTE.url,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: APP.fullName,
      alternateName: 'Matu Mailer',
      url: siteUrl,
      inLanguage: 'es-CO',
      publisher: {
        '@type': 'Organization',
        name: MATUBYTE.name,
        url: MATUBYTE.url,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_FOR_JSON_LD,
    },
  ];
}

const FAQ_FOR_JSON_LD = [
  {
    '@type': 'Question',
    name: '¿Qué es MatuMailer?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'MatuMailer es una plataforma de infraestructura de correo para desarrolladores. Permite enviar correos transaccionales con dominios verificados, aliases, plantillas y un SDK npm, sin montar servidores propios ni compartir credenciales SMTP.',
    },
  },
  {
    '@type': 'Question',
    name: '¿MatuMailer tiene plan gratuito?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Sí. El plan gratuito incluye 1 proyecto, dominio verificado, aliases, plantillas personalizadas y correos de prueba para integrar tu producto sin costo inicial.',
    },
  },
  {
    '@type': 'Question',
    name: '¿Cómo envío correos sin SMTP?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Verificas tu dominio por DNS (SPF/DKIM), creas aliases como ventas@tudominio.com y envías desde la API o el SDK. MatuMailer entrega por su relay de plataforma; no pides host, usuario ni contraseña SMTP al usuario.',
    },
  },
  {
    '@type': 'Question',
    name: '¿Cómo integro MatuMailer en mi código?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Instala el paquete npm matumailer, crea un token de API en el dashboard y envía correos con pocas líneas de código en Node.js, Next.js o cualquier backend JavaScript.',
    },
  },
];
