/** HTML base para plantillas del sistema (estilo Crextio / MatuMailer). */
function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f0e6;font-family:'Segoe UI',system-ui,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e6">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(28,25,23,0.1)">
<tr><td style="height:8px;background:linear-gradient(90deg,#c9a227,#f5e6b8)"></td></tr>
${body}
<tr><td style="padding:28px 40px;text-align:center;font-size:12px;color:#a8a29e;border-top:1px solid #f5f5f4">
  © MatuMailer · Este correo fue generado automáticamente
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export const SYSTEM_TEMPLATES = [
  {
    slug: 'welcome',
    name: 'Bienvenida',
    subject: 'Bienvenido/a, {{nombre}}',
    html_content: shell(`
<tr><td style="padding:48px 40px 24px;text-align:center">
  <div style="width:64px;height:64px;margin:0 auto 20px;border-radius:50%;background:linear-gradient(135deg,#c9a227,#f5e6b8);line-height:64px;font-size:28px">✉</div>
  <h1 style="margin:0;font-size:32px;font-weight:700;color:#1c1917">¡Hola, {{nombre}}!</h1>
</td></tr>
<tr><td style="padding:0 40px 32px;text-align:center">
  <p style="margin:0;font-size:17px;line-height:1.7;color:#57534e">Gracias por unirte. Estamos encantados de tenerte con nosotros.</p>
</td></tr>
<tr><td style="padding:0 40px 48px;text-align:center">
  <a href="{{enlace}}" style="display:inline-block;padding:16px 36px;background:#c9a227;color:#1c1917;font-size:16px;font-weight:600;text-decoration:none;border-radius:999px">Comenzar ahora</a>
</td></tr>`),
    variables: ['nombre', 'enlace'],
  },
  {
    slug: 'password-recovery',
    name: 'Recuperar contraseña',
    subject: 'Restablece tu contraseña',
    html_content: shell(`
<tr><td style="padding:40px 40px 16px">
  <h1 style="margin:0;font-size:26px;color:#1c1917">Restablecer contraseña</h1>
</td></tr>
<tr><td style="padding:0 40px 24px">
  <p style="margin:0;font-size:16px;line-height:1.7;color:#57534e">Hola <strong>{{nombre}}</strong>, recibimos una solicitud para cambiar tu contraseña. El enlace expira pronto.</p>
</td></tr>
<tr><td style="padding:8px 40px 40px">
  <a href="{{resetLink}}" style="display:inline-block;padding:14px 32px;background:#1c1917;color:#f5e6b8;font-size:15px;font-weight:600;text-decoration:none;border-radius:999px">Restablecer contraseña</a>
</td></tr>
<tr><td style="padding:0 40px 40px">
  <p style="margin:0;font-size:13px;color:#a8a29e">Si no solicitaste esto, ignora este correo.</p>
</td></tr>`),
    variables: ['nombre', 'resetLink'],
  },
  {
    slug: 'notification',
    name: 'Notificación',
    subject: '{{titulo}}',
    html_content: shell(`
<tr><td style="padding:40px 40px 8px">
  <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#c9a227">Notificación</p>
  <h2 style="margin:12px 0 0;font-size:24px;color:#1c1917">{{titulo}}</h2>
</td></tr>
<tr><td style="padding:16px 40px 40px">
  <p style="margin:0;font-size:16px;line-height:1.7;color:#44403c">{{mensaje}}</p>
</td></tr>`),
    variables: ['titulo', 'mensaje'],
  },
  {
    slug: 'campana',
    name: 'Campaña / Aviso masivo',
    subject: '{{titulo}}',
    html_content: shell(`
<tr><td style="padding:48px 40px 16px;text-align:center">
  <div style="width:72px;height:72px;margin:0 auto 24px;border-radius:50%;background:linear-gradient(135deg,#c9a227,#f5e6b8);line-height:72px;font-size:32px">📬</div>
  <h1 style="margin:0;font-size:28px;font-weight:700;color:#1c1917">Hola, {{primerNombre}}</h1>
</td></tr>
<tr><td style="padding:8px 40px 24px;text-align:center">
  <p style="margin:0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#c9a227">{{titulo}}</p>
</td></tr>
<tr><td style="padding:0 40px 32px">
  <p style="margin:0;font-size:17px;line-height:1.75;color:#57534e;text-align:center">{{mensaje}}</p>
</td></tr>
<tr><td style="padding:0 40px 48px;text-align:center">
  <a href="{{enlace}}" style="display:inline-block;padding:16px 40px;background:#c9a227;color:#1c1917;font-size:16px;font-weight:600;text-decoration:none;border-radius:999px">Ver más</a>
</td></tr>
<tr><td style="padding:0 40px 32px">
  <p style="margin:0;font-size:13px;line-height:1.6;color:#a8a29e;text-align:center">Este mensaje fue enviado solo a tu correo. Nadie más puede ver tu dirección.</p>
</td></tr>`),
    variables: ['primerNombre', 'titulo', 'mensaje', 'enlace'],
  },
];
