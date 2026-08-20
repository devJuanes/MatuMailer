import type { ProjectBranding } from '@matumailer/shared';
import { renderTemplate } from './template-engine.js';

export function applyBranding(
  html: string,
  subject: string,
  data: Record<string, unknown>,
  branding: ProjectBranding | null,
): { html: string; subject: string } {
  const brandData: Record<string, unknown> = {
    ...data,
    logo: branding?.logo_url ?? '',
    companyName: branding?.company_name ?? data.companyName ?? '',
    primaryColor: branding?.primary_color ?? '#c9a227',
  };

  let body = html;
  if (branding?.header_html) {
    const header = renderTemplate(branding.header_html, '', brandData).html;
    if (!body.includes(header)) {
      body = `${header}${body}`;
    }
  }
  if (branding?.footer_html) {
    const footer = renderTemplate(branding.footer_html, '', brandData).html;
    if (!body.includes(footer)) {
      body = `${body}${footer}`;
    }
  }
  if (branding?.logo_url && !body.includes(branding.logo_url) && body.includes('</body>')) {
    // no-op: templates should use {{logo}}
  }

  return renderTemplate(body, subject, brandData);
}

export function injectTracking(html: string, trackingToken: string, publicBaseUrl: string): string {
  const base = publicBaseUrl.replace(/\/$/, '');
  const pixel = `<img src="${base}/t/o/${trackingToken}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0" />`;

  let out = html.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (_m, url: string) => {
    // No reescribir tracking ni enlaces de privacidad.
    if (url.includes('/t/') || /unsubscribe|opt[-_]?out|privacy/i.test(url)) {
      return `href="${url}"`;
    }
    const tracked = `${base}/t/c/${trackingToken}?u=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });

  // Sin pie de "cancela la suscripción" — el correo se muestra limpio.
  if (out.includes('</body>')) {
    out = out.replace('</body>', `${pixel}</body>`);
  } else {
    out = `${out}${pixel}`;
  }
  return out;
}
