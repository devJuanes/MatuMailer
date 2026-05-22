import type { SmtpConfig } from './types';

export interface DeliverabilityCheck {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
}

export interface DeliverabilityReport {
  score: number;
  checks: DeliverabilityCheck[];
  tips: string[];
}

/** Convierte HTML a texto plano (multipart mejora mucho la entrega). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Asuntos con muchos signos o mayúsculas suelen ir a spam. */
export function sanitizeSubject(subject: string): string {
  let s = subject.trim().replace(/\s+/g, ' ');
  if (s.length > 78) s = `${s.slice(0, 75)}…`;
  s = s.replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?');
  if (s.length > 10 && s === s.toUpperCase() && /[A-ZÁÉÍÓÚ]/.test(s)) {
    s = s.charAt(0) + s.slice(1).toLowerCase();
  }
  return s;
}

function domainOf(email: string): string | null {
  const d = email.split('@')[1]?.toLowerCase().trim();
  return d || null;
}

/** Remitente y usuario SMTP deben compartir dominio (alineación SPF). */
export function isFromDomainAligned(config: Pick<SmtpConfig, 'from_email' | 'username'>): boolean {
  const from = domainOf(config.from_email);
  const user = domainOf(config.username);
  return !!from && !!user && from === user;
}

/** Inyecta preheader oculto y asegura estructura mínima válida. */
export function normalizeHtmlForInbox(html: string, preheader?: string): string {
  let out = html.trim();
  if (!out.toLowerCase().includes('<!doctype')) {
    out = `<!DOCTYPE html>\n${out}`;
  }
  if (!/<html[\s>]/i.test(out)) {
    out = `<html lang="es"><body>${out}</body></html>`;
  }
  if (!/<meta[^>]+charset/i.test(out)) {
    out = out.replace(/<head>/i, '<head><meta charset="utf-8"/>');
  }

  const preview =
    preheader?.trim() ||
    htmlToPlainText(out).split('\n').find((l) => l.trim().length > 12)?.trim().slice(0, 120) ||
    '';

  if (preview && !out.includes('matur-preheader')) {
    const preheaderBlock = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all" aria-hidden="true">${preview}</div>`;
    if (/<body[^>]*>/i.test(out)) {
      out = out.replace(/<body([^>]*)>/i, `<body$1>${preheaderBlock}`);
    } else {
      out = preheaderBlock + out;
    }
  }

  return out;
}

const SPAMMY_WORDS = [
  'gratis',
  'free',
  'click here',
  'haz clic aquí',
  'urgente',
  'actúa ya',
  'winner',
  'ganador',
  '100%',
  'sin riesgo',
];

export function analyzeContentRisks(subject: string, html: string): string[] {
  const risks: string[] = [];
  const combined = `${subject} ${htmlToPlainText(html)}`.toLowerCase();
  for (const word of SPAMMY_WORDS) {
    if (combined.includes(word)) risks.push(`Evita la expresión «${word}» en asunto o cuerpo.`);
  }
  const linkCount = (html.match(/<a\s/gi) ?? []).length;
  if (linkCount > 8) risks.push('Demasiados enlaces; reduce a los imprescindibles.');
  const imgCount = (html.match(/<img\s/gi) ?? []).length;
  const textLen = htmlToPlainText(html).length;
  if (imgCount > 0 && textLen < 80) {
    risks.push('Añade más texto; correos solo con imagen suelen ir a spam.');
  }
  if (subject.includes('!!!') || subject.includes('???')) {
    risks.push('Reduce signos de exclamación o interrogación en el asunto.');
  }
  return risks;
}

export function buildDeliverabilityReport(
  config: Pick<SmtpConfig, 'from_email' | 'username' | 'from_name' | 'is_verified'> | null,
  subject?: string,
  html?: string,
): DeliverabilityReport {
  const checks: DeliverabilityCheck[] = [];
  const tips: string[] = [
    'Usa el mismo dominio en «Correo remitente» y «Usuario SMTP» (Gmail → @gmail.com en ambos).',
    'Configura SPF/DKIM en tu dominio si usas correo corporativo (Zoho, dominio propio).',
    'Evita adjuntos pesados en el primer envío; prioriza HTML + texto plano.',
    'Pide a los destinatarios que marquen «No es spam» la primera vez.',
  ];

  if (!config) {
    checks.push({
      id: 'smtp',
      ok: false,
      label: 'SMTP configurado',
      detail: 'Guarda la configuración SMTP del proyecto.',
    });
    return { score: 0, checks, tips };
  }

  const aligned = isFromDomainAligned(config);
  checks.push({
    id: 'spf-align',
    ok: aligned,
    label: 'Remitente alineado con SMTP',
    detail: aligned
      ? 'El dominio del remitente coincide con el usuario SMTP (bueno para SPF).'
      : 'El correo remitente debe ser del mismo dominio que el usuario SMTP.',
  });

  checks.push({
    id: 'verified',
    ok: config.is_verified,
    label: 'Conexión SMTP verificada',
    detail: config.is_verified
      ? 'La conexión fue probada correctamente.'
      : 'Pulsa «Probar conexión» antes de enviar masivamente.',
  });

  checks.push({
    id: 'from-name',
    ok: !!config.from_name?.trim(),
    label: 'Nombre del remitente',
    detail: config.from_name?.trim()
      ? `Los destinatarios verán: ${config.from_name}`
      : 'Añade un nombre (ej. tu marca) en lugar de solo el correo.',
  });

  if (subject !== undefined) {
    const clean = sanitizeSubject(subject);
    checks.push({
      id: 'subject',
      ok: clean === subject.trim() && subject.length <= 78,
      label: 'Asunto equilibrado',
      detail:
        clean === subject.trim()
          ? 'Longitud y formato del asunto adecuados.'
          : 'Acorta el asunto o quita signos repetidos (!!!).',
    });
  }

  if (html !== undefined && html.length > 0) {
    const text = htmlToPlainText(html);
    checks.push({
      id: 'plain-fallback',
      ok: text.length >= 40,
      label: 'Contenido en texto',
      detail:
        text.length >= 40
          ? 'Hay suficiente texto; se enviará también versión plain text.'
          : 'Añade más texto visible en la plantilla.',
    });
    tips.push(...analyzeContentRisks(subject ?? '', html));
  }

  const providerDomain = domainOf(config.from_email);
  if (providerDomain === 'gmail.com' || providerDomain === 'googlemail.com') {
    tips.push('En Gmail: usa contraseña de aplicación y el mismo @gmail.com como remitente.');
  }
  if (providerDomain?.includes('zoho')) {
    tips.push('En Zoho: verifica SPF/DKIM en el panel de dominio (Zoho Mail → Configuración de correo).');
  }

  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, checks, tips: [...new Set(tips)] };
}
