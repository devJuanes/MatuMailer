/** Traduce errores SMTP/técnicos a mensajes claros para humanos. */
export function humanizeEmailError(raw: string): string {
  const msg = (raw || '').toLowerCase();

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
  if (/authentication failed|invalid login|535|incorrect password|auth/i.test(msg)) {
    return 'Falló la autenticación SMTP. Revisa usuario y contraseña de aplicación.';
  }
  if (/connection|econnrefused|etimedout|timeout|enetunreach|socket/i.test(msg)) {
    return 'No se pudo conectar al servidor SMTP. Verifica host, puerto y red.';
  }
  if (/relay|554.*relay|not permitted to relay/i.test(msg)) {
    return 'El servidor SMTP no permite reenviar correos con este remitente.';
  }
  if (/spam|blocked|blacklist|reputation/i.test(msg)) {
    return 'El mensaje fue bloqueado por filtros antispam del proveedor destino.';
  }
  if (/tls|ssl|certificate/i.test(msg)) {
    return 'Error de seguridad TLS/SSL al conectar con el servidor SMTP.';
  }
  if (/smtp_not_configured/i.test(msg)) {
    return 'Este proyecto aún no tiene SMTP configurado.';
  }
  if (/smtp_not_verified/i.test(msg)) {
    return 'La conexión SMTP no está verificada. Prueba la conexión antes de enviar.';
  }
  if (/smtp_from_domain_mismatch/i.test(msg)) {
    return 'El dominio del remitente no coincide con el usuario SMTP (riesgo de spam).';
  }
  if (/template_not_found/i.test(msg)) {
    return 'La plantilla indicada no existe en este proyecto.';
  }
  if (/rate|too many|throttl/i.test(msg)) {
    return 'Se alcanzó el límite de envíos del proveedor. Espera e intenta de nuevo.';
  }
  if (/unsubscribed/i.test(msg)) {
    return 'Este contacto se dio de baja y no recibirá más correos.';
  }

  if (raw && raw.length < 180) {
    return `No se pudo enviar el correo: ${raw}`;
  }
  return 'No se pudo enviar el correo por un error del servidor. Revisa la configuración SMTP y el destinatario.';
}
