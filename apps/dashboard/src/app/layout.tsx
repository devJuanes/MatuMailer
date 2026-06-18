import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import { APP, MATUBYTE } from '@/lib/brand';
import { LANDING_SEO, getSiteUrl } from '@/lib/seo';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: LANDING_SEO.title,
    template: `%s | ${APP.fullName}`,
  },
  description: LANDING_SEO.description,
  keywords: LANDING_SEO.keywords,
  authors: [{ name: MATUBYTE.name, url: MATUBYTE.url }],
  creator: MATUBYTE.name,
  publisher: MATUBYTE.name,
  applicationName: APP.fullName,
  icons: {
    icon: APP.favicon,
    apple: APP.favicon,
  },
  manifest: '/manifest.json',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: APP.fullName,
    title: LANDING_SEO.title,
    description: LANDING_SEO.description,
    images: [{ url: APP.logo, width: 512, height: 512, alt: APP.fullName }],
  },
  twitter: {
    card: 'summary_large_image',
    title: LANDING_SEO.title,
    description: LANDING_SEO.description,
    images: [APP.logo],
  },
};

export const viewport: Viewport = {
  themeColor: APP.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
