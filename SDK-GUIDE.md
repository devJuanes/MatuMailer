# Guía del SDK `matumailer` — paso a paso

Documentación para integrar MatuMailer en tu código (Node.js, Next.js, scripts, etc.).

- **API en producción:** `https://api.matucatalogo.com`
- **Dashboard:** `https://mail.matucatalogo.com`
- **Paquete npm:** `matumailer`

---

## 1. Qué necesitas antes de programar

| Requisito                 | Dónde se configura                      | Por qué                                                              |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Cuenta MatuMailer         | Dashboard → registro                    | Identidad y proyectos                                                |
| Un **proyecto**           | Dashboard → Proyectos                   | Agrupa SMTP, plantillas y tokens                                     |
| **SMTP** verificado       | Dashboard → SMTP del proyecto           | Sin esto la API responde `SMTP_NOT_CONFIGURED` o `SMTP_NOT_VERIFIED` |
| **Token de API**          | Dashboard → proyecto → Tokens API       | Autenticación en `Authorization: Bearer mm_live_...`                 |
| (Opcional) **Plantillas** | Dashboard → Plantillas o Creador visual | Solo si envías con `template: 'slug'`                                |

El token **no** es tu contraseña de login: es un secreto de proyecto que empieza por `mm_live_`.

---

## 2. Instalación

```bash
npm install matumailer
```

En TypeScript no hace falta instalar tipos aparte: vienen en el paquete.

---

## 3. Configuración en tu proyecto

### Variables de entorno (recomendado)

```env
MATUMAILER_TOKEN=mm_live_xxxxxxxxxxxxxxxxxxxxxxxx
# Opcional si usas otra URL (por defecto: api.matucatalogo.com)
MATUMAILER_API_URL=https://api.matucatalogo.com
```

### Código

```ts
import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN,
  baseUrl: process.env.MATUMAILER_API_URL, // opcional
});
```

Si no pasas `token`, el SDK lee `MATUMAILER_TOKEN`. Si falta, lanza error `MISSING_TOKEN`.

---

## 4. Enviar correo libre (HTML / texto propio)

No usas plantilla del dashboard: mandas el contenido en el request.

```ts
await mail.send({
  to: 'cliente@ejemplo.com',
  subject: 'Pedido confirmado',
  html: '<h1>Gracias por tu compra</h1><p>Pedido #1234</p>',
  text: 'Gracias por tu compra. Pedido #1234', // opcional, versión texto plano
});
```

### Varios destinatarios

```ts
await mail.send({
  to: ['a@ejemplo.com', 'b@ejemplo.com'],
  subject: 'Aviso',
  html: '<p>Mensaje para el equipo</p>',
});
```

### Reglas de la API

- Debes enviar al menos uno: `subject`, `html` o `template`.
- Para correo libre: incluye `subject` + `html` (o `text`).

---

## 5. Enviar con plantilla del dashboard

### Paso A — Crear la plantilla

1. Entra al dashboard → tu proyecto → **Plantillas** (o **Creador**).
2. Define **asunto** y **HTML** con variables en formato `{{nombreVariable}}`, por ejemplo:

   ```html
   <p>Hola {{nombre}}, tu código es {{codigo}}</p>
   ```

3. Guarda y anota el **slug** de la plantilla (ej. `bienvenida`, `reset-password`). Ese slug es el que usas en código.

### Paso B — Enviar desde código

**Opción 1 — `sendTemplate` (atajo)**

```ts
await mail.sendTemplate(
  'usuario@ejemplo.com',
  'bienvenida', // slug de la plantilla
  {
    nombre: 'Ana',
    codigo: '48291',
  },
  'Bienvenida a MatuMailer', // subject opcional (si no, usa el de la plantilla)
);
```

**Opción 2 — `send` (mismo endpoint)**

```ts
await mail.send({
  to: 'usuario@ejemplo.com',
  template: 'bienvenida',
  data: {
    nombre: 'Ana',
    codigo: '48291',
  },
});
```

### Variables

- Sintaxis en la plantilla: `{{variable}}` (solo letras, números y `_` en el nombre).
- En `data` pasas un objeto clave → valor. Si falta una clave, se reemplaza por cadena vacía.
- El **asunto** de la plantilla también puede llevar `{{variables}}`.

### Dónde ver ejemplos por plantilla

En el dashboard, al editar una plantilla, el bloque **“Cómo usar esta plantilla”** genera snippets con tu slug y variables reales (SDK, cURL).

---

## 6. Programar envío para más tarde

Pasa `scheduledAt` en ISO 8601 (UTC recomendado):

```ts
await mail.send({
  to: 'cliente@ejemplo.com',
  template: 'recordatorio',
  data: { nombre: 'Luis' },
  scheduledAt: '2026-05-25T15:00:00.000Z',
});
```

La API responde con `scheduled: true` y un `id` del envío programado. Un worker en el servidor lo envía cuando llega la hora.

---

## 7. Ejemplo completo (Next.js API Route)

```ts
// app/api/notificar/route.ts
import { MatuMailer } from 'matumailer';
import { NextResponse } from 'next/server';

const mail = new MatuMailer({ token: process.env.MATUMAILER_TOKEN! });

export async function POST(req: Request) {
  const { email, nombre } = await req.json();

  try {
    const result = await mail.sendTemplate(email, 'bienvenida', { nombre });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al enviar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Importante:** el token solo en el servidor (`.env`), nunca en el navegador del usuario final.

---

## 8. Ejemplo con fetch (sin SDK)

```bash
curl -X POST https://api.matucatalogo.com/api/emails/send \
  -H "Authorization: Bearer mm_live_TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@ejemplo.com",
    "template": "bienvenida",
    "data": { "nombre": "Ana" }
  }'
```

Correo libre:

```bash
curl -X POST https://api.matucatalogo.com/api/emails/send \
  -H "Authorization: Bearer mm_live_TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@ejemplo.com",
    "subject": "Hola",
    "html": "<p>Mensaje libre</p>"
  }'
```

---

## 9. Respuestas y errores frecuentes

### Éxito (envío inmediato)

```json
{
  "success": true,
  "scheduled": false,
  "id": "uuid-del-log",
  "status": "sent"
}
```

### Errores habituales

| Código / mensaje      | Causa                               | Qué hacer                       |
| --------------------- | ----------------------------------- | ------------------------------- |
| `SMTP_NOT_CONFIGURED` | No hay SMTP en el proyecto          | Configura SMTP en el dashboard  |
| `SMTP_NOT_VERIFIED`   | SMTP sin verificar                  | Usa “Verificar” en el dashboard |
| `TEMPLATE_NOT_FOUND`  | Slug incorrecto o de otro proyecto  | Revisa el slug en Plantillas    |
| `401`                 | Token inválido o revocado           | Genera un token nuevo           |
| `MISSING_TOKEN` (SDK) | Falta token en constructor o `.env` | Define `MATUMAILER_TOKEN`       |

---

## 10. Checklist rápido

1. [ ] SMTP del proyecto configurado y **verificado**
2. [ ] Token API copiado (`mm_live_...`)
3. [ ] `npm install matumailer`
4. [ ] `.env` con `MATUMAILER_TOKEN`
5. [ ] Prueba correo **libre** con `html` + `subject`
6. [ ] (Opcional) Plantilla creada → envío con `template` + `data`

---

## 11. Más referencia

- Swagger interactivo: `https://api.matucatalogo.com/docs`
- Publicar el paquete en npm: [NPM-PUBLISH.md](./NPM-PUBLISH.md)
- Despliegue del servidor: [DEPLOY-SERVIDOR.md](./DEPLOY-SERVIDOR.md)
