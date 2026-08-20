# Guía del SDK `matumailer` — paso a paso

Documentación para integrar MatuMailer en tu código (Node.js, Next.js, scripts, etc.).

- **API en producción:** `https://api.matucatalogo.com`
- **Dashboard:** `https://mail.matucatalogo.com`
- **Paquete npm:** `matumailer`

---

## 1. Qué necesitas antes de programar

| Requisito                         | Dónde se configura                      | Por qué                                                              |
| --------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Cuenta MatuMailer                 | Dashboard → registro                    | Identidad y proyectos                                                |
| Un **proyecto**                   | Dashboard → Proyectos                   | Aísla dominios, aliases, tokens y envíos                             |
| **Dominio verificado por DNS**    | Dashboard → Dominios                    | Identidad de envío (SPF/DKIM/DMARC)                                  |
| **Alias** (identidad de envío)    | Dashboard → Aliases                     | `from` autorizado, p. ej. `soporte@tudominio.com`                    |
| **Token de API**                  | Dashboard → proyecto → Tokens API       | Autenticación en `Authorization: Bearer mm_live_...`                 |
| (Opcional) **Plantillas**         | Dashboard → Plantillas o Creador visual | Solo si envías con `template: 'slug'`                                |

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

## 4.5 Dominios personalizados (estilo Resend)

Una vez tu dominio está verificado y tienes DKIM, puedes enviar desde cualquier dirección `@tudominio.com`:

```ts
await mail.send({
  to: 'cliente@ejemplo.com',
  from: 'support@destin.com',
  fromName: 'Soporte Destin',
  replyTo: 'hola@destin.com',
  subject: 'Hola {{name}}',
  html: '<p>Hola {{name}}</p>',
  data: { name: 'Juan' },
});
```

### Flujo completo desde el SDK

```ts
// 1. Listar / crear dominios
const { domains } = await mail.listDomains(projectId);

const { domain } = await mail.createDomain(projectId, {
  domain: 'destin.com',
  region: 'sa-east-1', // us-east-1 | sa-east-1 | eu-west-1
});

// 2. Publica los registros DNS que te imprime la consola / dashboard
console.log(domain.records);

// 3. Verifica cuando estén propagados
const result = await mail.verifyDomain(domain.id);
if (!result.verified) {
  console.warn('Faltan:', result.missing);
}

// 4. Marca como default (opcional)
await mail.setDefaultDomain(domain.id);
```

Cuando el `from` pertenezca a un dominio verificado, MatuMailer firma DKIM automáticamente con la
clave privada RSA 2048 que se generó al añadir el dominio.

---

## 4.6 Aliases (`info@`, `support@`, `sales@`, ...)

Por cada dominio verificado puedes crear aliases ilimitados. El alias es la identidad
visible que aparece como `From` en el cliente del destinatario. Cualquier alias activo puede
usarse como `from` en una llamada de envío.

```ts
// Crear
const { alias } = await mail.createAlias(projectId, {
  domainId: 'uuid-del-dominio',
  localPart: 'support', // genera support@destin.com
  displayName: 'Soporte Destin', // nombre visible
  isDefault: true, // marca como default del dominio
});

// Listar (con filtros opcionales)
const { aliases } = await mail.listAliases(projectId, {
  domainId: 'uuid-del-dominio', // opcional: filtrar por dominio
  activeOnly: true, // opcional: solo activos
});

// Editar
await mail.updateAlias(alias.id, {
  isActive: false,
  displayName: 'Soporte (fuera de horario)',
});

// Eliminar
await mail.deleteAlias(alias.id);
```

### Reglas

- **`localPart`** solo acepta `a-z`, `0-9`, `.`, `_`, `+`, `-` (RFC 5321 permisivo).
- **Un único `default = true` por dominio** (índice único parcial). El primero que crees
  se marca automáticamente como default si no hay otro.
- **`displayName`** aparece como el nombre del remitente en Gmail/Outlook.
- **`replyTo`** por defecto del alias: si no lo pasas en el `mail.send()`, el server usa este.
- Si llamas a `mail.send({ from: 'support@destin.com' })` y ese alias está `isActive: false`,
  el server rechaza con `FROM_NOT_ALIAS_OF_VERIFIED_DOMAIN`.

### Enviar con alias por defecto

Si el proyecto tiene un único dominio verificado con su alias default, basta con:

```ts
await mail.send({
  to: 'user@gmail.com',
  subject: 'Hola',
  html: '<p>...</p>',
  // No pasamos `from` → el server elige el alias default del proyecto.
});
```

### Proyectos con múltiples dominios

Si el proyecto tiene `destin.com` y `otro.com` verificados, fuerza cuál usar con `domainId`:

```ts
await mail.send({
  to: 'user@gmail.com',
  domainId: 'uuid-de-otro-com',
  subject: '...',
  html: '...',
});
// O, equivalentemente, pasando un `from` concreto:
await mail.send({
  to: 'user@gmail.com',
  from: 'info@otro.com',
  subject: '...',
  html: '...',
});
```

---

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

## 8b. Android / Kotlin (sin SDK npm)

Desde Android llama a la API REST con OkHttp (o Retrofit). Base URL: la misma que `MATUMAILER_API_URL` / dashboard (`NEXT_PUBLIC_API_URL`).

```kotlin
val client = OkHttpClient()
val json = JSONObject()
  .put("to", "cliente@ejemplo.com")
  .put("template", "bienvenida")
  .put("data", JSONObject().put("nombre", "Ana"))
  .toString()
  .toRequestBody("application/json".toMediaType())

val request = Request.Builder()
  .url("https://matumailer.matubyte.com/api/emails/send")
  .addHeader("Authorization", "Bearer mm_live_TU_TOKEN")
  .post(json)
  .build()

client.newCall(request).execute()
```

**Plantillas vía API** (también con token `mm_live_...`):

| Método | Ruta                        | Uso                                                           |
| ------ | --------------------------- | ------------------------------------------------------------- |
| GET    | `/api/templates`            | Listar                                                        |
| GET    | `/api/templates/slug/:slug` | Obtener una                                                   |
| POST   | `/api/templates`            | Crear (`slug`, `name`, `subject`, `htmlContent`, `variables`) |
| PATCH  | `/api/templates/id/:id`     | Actualizar                                                    |
| DELETE | `/api/templates/id/:id`     | Eliminar                                                      |
| POST   | `/api/emails/send/bulk`     | Masivo (1 correo por destinatario)                            |

Más ejemplos en el dashboard → **Documentación**.

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
| `NO_VERIFIED_DOMAIN` / `DOMAIN_NOT_VERIFIED` | Dominio sin DNS listo            | Verifica SPF/DKIM en Dominios   |
| `NO_DEFAULT_SENDING_IDENTITY` | Varios aliases y ninguno default | Indica `from` o marca predeterminado |
| `SENDING_IDENTITY_NOT_ALLOWED` | Alias de otro proyecto           | Usa un alias de **este** proyecto |
| `TEMPLATE_NOT_FOUND`  | Slug incorrecto o de otro proyecto  | Revisa el slug en Plantillas    |
| `401`                 | Token inválido o revocado           | Genera un token nuevo           |
| `MISSING_TOKEN` (SDK) | Falta token en constructor o `.env` | Define `MATUMAILER_TOKEN`       |

---

## 10. Checklist rápido

1. [ ] Dominio verificado por DNS y al menos un **alias** activo
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
