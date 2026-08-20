/** Traduce errores de envío a mensajes claros para humanos. */

export const CLIENT_EMAIL_ERROR_CODES = new Set([
  'SENDING_IDENTITY_NOT_FOUND',
  'SENDING_IDENTITY_NOT_VERIFIED',
  'SENDING_IDENTITY_NOT_ALLOWED',
  'SENDING_IDENTITY_DISABLED',
  'DOMAIN_NOT_VERIFIED',
  'DOMAIN_NOT_FOUND',
  'DOMAIN_NOT_ALLOWED_FOR_PROJECT',
  'NO_DEFAULT_SENDING_IDENTITY',
  'NO_VERIFIED_DOMAIN',
  'NO_ALIAS_ON_DOMAIN',
  'ALIAS_NOT_FOUND',
  'ALIAS_REQUIRED',
  'FROM_NOT_ALIAS_OF_VERIFIED_DOMAIN',
  'FROM_DOMAIN_NOT_VERIFIED',
  'NO_DEFAULT_FROM',
  'DKIM_KEY_DECRYPT_FAILED',
  'TEMPLATE_NOT_FOUND',
  'INVALID_SCHEDULE_TIME',
  'SCHEDULE_TOO_SOON',
  'GROUP_EMPTY',
  'EMAIL_FIELD_NOT_FOUND',
  'NO_RECIPIENTS',
]);

export function parseEmailErrorCode(message: string): string {
  return (message || '').split(' — ')[0].split(':')[0].trim();
}

export function isClientEmailError(message: string): boolean {
  return CLIENT_EMAIL_ERROR_CODES.has(parseEmailErrorCode(message));
}

export function humanizeEmailError(raw: string): string {
  const code = parseEmailErrorCode(raw);
  const msg = (raw || '').toLowerCase();

  if (code === 'NO_DEFAULT_SENDING_IDENTITY' || code === 'ALIAS_REQUIRED') {
    return raw.includes('—') ? raw.split('—').slice(1).join('—').trim() : raw;
  }
  if (code === 'SENDING_IDENTITY_NOT_FOUND' || code === 'ALIAS_NOT_FOUND') {
    return 'Ese remitente no existe en este proyecto.';
  }
  if (code === 'SENDING_IDENTITY_NOT_ALLOWED') {
    return 'Ese remitente no pertenece a este proyecto.';
  }
  if (code === 'SENDING_IDENTITY_DISABLED') {
    return 'Ese alias está desactivado. Actívalo o elige otro remitente.';
  }
  if (code === 'SENDING_IDENTITY_NOT_VERIFIED') {
    return 'Ese alias aún no está listo para enviar.';
  }
  if (code === 'FROM_NOT_ALIAS_OF_VERIFIED_DOMAIN') {
    return 'El remitente debe ser un alias activo de un dominio verificado de este proyecto.';
  }
  if (
    code === 'FROM_DOMAIN_NOT_VERIFIED' ||
    code === 'NO_VERIFIED_DOMAIN' ||
    code === 'DOMAIN_NOT_VERIFIED'
  ) {
    return 'Verifica el dominio por DNS (SPF/DKIM) antes de enviar.';
  }
  if (code === 'NO_ALIAS_ON_DOMAIN') {
    return 'Crea al menos un alias (ej. hola@tudominio.com) en un dominio verificado.';
  }
  if (code === 'DOMAIN_NOT_FOUND' || code === 'DOMAIN_NOT_ALLOWED_FOR_PROJECT') {
    return 'El dominio indicado no pertenece a este proyecto.';
  }
  if (code === 'DKIM_KEY_DECRYPT_FAILED') {
    return 'La clave DKIM del dominio no se puede leer. Contacta soporte o vuelve a registrar el dominio con la ENCRYPTION_KEY correcta.';
  }

  if (
    /user unknown|mailbox unavailable|recipient.*rejected|550.*5\.1\.1|no such user|does not exist/i.test(
      msg,
    )
  ) {
    return 'Este correo no existe o la bandeja fue rechazada por el servidor destino.';
  }
  if (/mailbox full|quota exceeded|over quota|452.*4\.2\.2/i.test(msg)) {
    return 'La bandeja del destinatario está llena; no pudo recibir el mensaje.';
  }
  if (/connection|econnrefused|etimedout|timeout|enetunreach|socket/i.test(msg)) {
    return 'No se pudo conectar al servidor de salida. Revisa el relay de MatuMailer.';
  }
  if (/relay|554.*relay|not permitted to relay/i.test(msg)) {
    return 'El servidor de salida no permite reenviar correos con este remitente.';
  }
  if (/spam|blocked|blacklist|reputation/i.test(msg)) {
    return 'El mensaje fue bloqueado por filtros antispam del proveedor destino.';
  }
  if (/tls|ssl|certificate/i.test(msg)) {
    return 'Error de seguridad TLS/SSL al conectar con el servidor de salida.';
  }
  if (/template_not_found/i.test(msg)) {
    return 'La plantilla indicada no existe en este proyecto.';
  }
  if (/rate|too many|throttl/i.test(msg)) {
    return 'Se alcanzó el límite de envíos. Espera e intenta de nuevo.';
  }
  if (/unsubscribed/i.test(msg)) {
    return 'Este contacto se dio de baja y no recibirá más correos.';
  }

  if (raw && raw.length < 180) {
    return `No se pudo enviar el correo: ${raw}`;
  }
  return 'No se pudo enviar el correo. Revisa el alias, el dominio verificado y el destinatario.';
}
