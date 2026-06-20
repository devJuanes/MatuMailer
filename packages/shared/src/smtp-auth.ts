import type { SmtpProvider } from './types';

export function normalizeSmtpUsername(value: string): string {
  return value.trim();
}

export function normalizeSmtpEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Gmail app passwords are often pasted with spaces (abcd efgh ijkl mnop). */
export function normalizeSmtpPassword(provider: SmtpProvider | string, password: string): string {
  const trimmed = password.trim();
  if (provider === 'gmail') {
    return trimmed.replace(/\s+/g, '');
  }
  return trimmed;
}

export function smtpAuthErrorMessage(provider: string, rawMessage: string): string {
  const msg = rawMessage.trim();
  if (/535|BadCredentials|Username and Password not accepted|authentication failed/i.test(msg)) {
    if (provider === 'gmail') {
      return [
        'Gmail rechazó el usuario o la contraseña.',
        'Usa una contraseña de aplicación de 16 caracteres (Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones).',
        'No uses tu contraseña normal de Gmail.',
        'El correo remitente y el usuario SMTP deben ser el mismo @gmail.com.',
      ].join(' ');
    }
    return 'Usuario o contraseña SMTP incorrectos. Revisa credenciales y que el remitente use el mismo dominio que el usuario.';
  }
  if (/ECONNECTION|ETIMEDOUT|ENOTFOUND|connect/i.test(msg)) {
    return `No se pudo conectar al servidor SMTP (${msg}). Revisa host y puerto.`;
  }
  return msg;
}
