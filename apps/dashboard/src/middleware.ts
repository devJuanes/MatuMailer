import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAIL_HOST =
  process.env.NEXT_PUBLIC_MAIL_HOST?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
  'mail.matubyte.com';
const APP_HOST =
  process.env.NEXT_PUBLIC_APP_HOST?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
  'matumailer.matubyte.com';

function hostOf(req: NextRequest): string {
  return (req.headers.get('host') || req.nextUrl.host || '').split(':')[0].toLowerCase();
}

/** mail.matubyte.com → bandeja en `/` (rewrite a /mail). matumailer…/mail → redirige al subdominio. */
export function middleware(request: NextRequest) {
  const host = hostOf(request);
  const { pathname, search } = request.nextUrl;
  const isMailHost = host === MAIL_HOST || host.startsWith('mail.');

  if (isMailHost) {
    if (pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone();
      url.pathname = '/mail';
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith('/mail')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace(/^\/mail/, '') || '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // En el host principal, /mail vive en el subdominio (prod).
  if (
    process.env.NODE_ENV === 'production' &&
    host === APP_HOST &&
    (pathname === '/mail' || pathname.startsWith('/mail/'))
  ) {
    const dest = new URL(`https://${MAIL_HOST}${pathname.replace(/^\/mail/, '') || '/'}${search}`);
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/mail', '/mail/:path*', '/login', '/dashboard/:path*'],
};
