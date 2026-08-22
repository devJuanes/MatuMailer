# Guía del SDK `matumailer` — paso a paso

Documentación para integrar MatuMailer en tu código (Node.js, Next.js, scripts, Android, cURL, etc.).

| Entorno                   | URL base de la API                | Dashboard / bandeja                                                         |
| ------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| **MatuByte (producción)** | `https://matumailer.matubyte.com` | App: `https://matumailer.matubyte.com` · Inbox: `https://mail.matubyte.com` |
| **MatuCatalogo**          | `https://api.matucatalogo.com`    | `https://mail.matucatalogo.com`                                             |
| **Local**                 | `http://localhost:4001`           | `http://localhost:3000`                                                     |

Swagger interactivo: `{BASE_URL}/docs` (ej. `https://matumailer.matubyte.com/docs`).

- **Paquete npm:** `matumailer`

---

## 1. Qué necesitas antes de programar

| Requisito                      | Dónde se configura                   | Por qué                                                    |
| ------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| Cuenta MatuMailer              | Dashboard → registro                 | Identidad y proyectos                                      |
| Un **proyecto**                | Dashboard → Proyectos                | Aísla dominios, aliases, tokens y envíos                   |
| **Dominio verificado (envío)** | Dashboard → Dominios → Verificar DNS | SPF + DKIM deben pasar para enviar                         |
| **Alias activo**               | Dashboard → Aliases                  | Es el único `from` permitido (ej. `soporte@tudominio.com`) |
| **Token de API**               | Dashboard → proyecto → Tokens API    | `Authorization: Bearer mm_live_...`                        |
| (Opcional) **Plantillas**      | Dashboard → Plantillas               | Solo si envías con `template: 'slug'`                      |

> **Importante:** no puedes poner cualquier dirección `@tudominio.com` en `from`. Debe ser un **alias registrado y activo** en el dashboard. Si el alias no existe o está desactivado, la API responde con un error de identidad de envío.

El token **no** es tu contraseña de login. Es un secreto de proyecto (`mm_live_...` en producción, `mm_test_...` en pruebas si lo generas).

---

## 2. Instalación

```bash
npm install matumailer
```

En TypeScript los tipos vienen incluidos en el paquete.

---

## 3. Configuración

### Variables de entorno (recomendado)

```env
MATUMAILER_TOKEN=mm_live_xxxxxxxxxxxxxxxxxxxxxxxx
# URL base — debe coincidir con tu despliegue (sin /api al final)
MATUMAILER_API_URL=https://matumailer.matubyte.com
```

### Código

```ts
import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN,
  baseUrl: process.env.MATUMAILER_API_URL, // opcional; default npm: api.matucatalogo.com
});
```

Si no pasas `token`, el SDK lee `MATUMAILER_TOKEN`. Si falta, lanza `MISSING_TOKEN`.

---

## 4. Autenticación por endpoint

| Operación                               | Token `mm_live_` / `mm_test_` | JWT de login (dashboard)                       |
| --------------------------------------- | ----------------------------- | ---------------------------------------------- |
| `POST /api/emails/send` (+ bulk, group) | ✓                             | ✓ (con `projectId` si tienes varios proyectos) |
| `GET /api/templates`, CRUD plantillas   | ✓                             | ✓                                              |
| `GET /api/sending-identities`           | ✓                             | ✓                                              |
| `GET /api/domains`, `GET /api/aliases`  | ✓                             | ✓                                              |
| `POST/PATCH/DELETE` dominios y aliases  | ✗                             | ✓ (sesión dashboard)                           |
| Verificar DNS, sync inbound             | ✗                             | ✓                                              |

**Desde backend con SDK:** usa siempre el token `mm_live_...` para enviar. Crea dominios y aliases en el **dashboard** (o con JWT en tu propio backend autenticado).

Header en todas las llamadas:

```http
Authorization: Bearer mm_live_TU_TOKEN
Content-Type: application/json
```

---

## 5. Aliases e identidades de envío

Un **alias** es la identidad visible del remitente (`From`). Ejemplos: `agenda@grupohuacas.com`, `soporte@tudominio.com`.

### Cómo elige la API el remitente

Si no pasas `from`, el orden de resolución es:

1. `aliasId` explícito
2. `from` (email completo del alias)
3. `domainId` + alias default de ese dominio
4. `default_alias_id` del proyecto
5. Un único alias activo en el proyecto
6. Error `NO_DEFAULT_SENDING_IDENTITY`

### Listar identidades listas para enviar (recomendado)

```ts
const { identities, defaultSendingIdentityId } = await mail.sendingIdentities.list();

console.log(
  identities.map((i) => ({
    email: i.email,
    displayName: i.displayName,
    isDefault: i.isDefault,
  })),
);
```

### Enviar con alias explícito

```ts
await mail.send({
  to: 'cliente@ejemplo.com',
  from: 'agenda@grupohuacas.com',
  fromName: 'Agenda Grupo Huacas', // opcional; si no, usa displayName del alias
  subject: 'Confirmación de cita',
  html: '<p>Tu cita está confirmada.</p>',
});
```

### Enviar con `aliasId` (UUID)

```ts
await mail.send({
  to: 'cliente@ejemplo.com',
  aliasId: 'uuid-del-alias',
  subject: 'Hola',
  html: '<p>...</p>',
});
```

### Enviar sin `from` (un solo alias o default)

```ts
await mail.send({
  to: 'cliente@ejemplo.com',
  subject: 'Pedido confirmado',
  html: '<h1>Gracias</h1>',
});
```

### Varios dominios en el mismo proyecto

```ts
await mail.send({
  to: 'user@gmail.com',
  domainId: 'uuid-del-dominio',
  subject: 'Aviso',
  html: '<p>...</p>',
});
```

### Gestionar aliases (dashboard o JWT)

```ts
// Solo lectura con mm_live_:
const { aliases } = await mail.listAliases(projectId, { activeOnly: true });

// Crear/editar/eliminar → requiere sesión JWT (dashboard), no mm_live_:
// Dashboard → Aliases → Crear alias
```

### Reglas de aliases

- **`localPart`:** solo `a-z`, `0-9`, `.`, `_`, `+`, `-`
- **Un `isDefault` por dominio** (el primero puede marcarse automáticamente)
- **`displayName`:** nombre visible en Gmail/Outlook
- **`replyTo`:** si no lo pasas en `send()`, se usa el del alias
- Alias **inactivo** → `SENDING_IDENTITY_DISABLED`
- Email en `from` que no existe → `SENDING_IDENTITY_NOT_FOUND`

---

## 6. Enviar correo libre (HTML / texto)

```ts
await mail.send({
  to: 'cliente@ejemplo.com',
  from: 'soporte@tudominio.com',
  subject: 'Pedido confirmado',
  html: '<h1>Gracias por tu compra</h1>',
  text: 'Gracias por tu compra.', // opcional
  replyTo: 'ventas@tudominio.com', // opcional
  cc: 'copia@ejemplo.com',
  tags: [{ name: 'tipo', value: 'transaccional' }],
});
```

### Varios destinatarios en `/send`

```ts
await mail.send({
  to: ['a@ejemplo.com', 'b@ejemplo.com'],
  subject: 'Aviso',
  html: '<p>Mensaje</p>',
});
```

Cada destinatario recibe su propio correo (no se ven entre sí). Aplica límites de plan bulk.

### Reglas del body

- Al menos uno de: `subject`, `html` o `template`
- Correo libre: incluye `subject` + `html` (o `text`)

---

## 7. Dominios personalizados (envío)

1. **Dashboard → Dominios → Añadir dominio** (o SDK con JWT)
2. Publica los registros DNS (SPF, DKIM, DMARC; MX/return-path si también quieres **recibir**)
3. **Verificar DNS** en el dashboard hasta que **Envío** (SPF + DKIM) esté OK
4. **Crea al menos un alias** activo en ese dominio
5. Envía con `from: 'alias@tudominio.com'`

MatuMailer firma **DKIM** automáticamente con la clave del dominio verificado.

### Envío vs recepción

| Capacidad     | Requisito DNS                                                | Uso                            |
| ------------- | ------------------------------------------------------------ | ------------------------------ |
| **Envío**     | SPF + DKIM verificados                                       | API/SDK `send`                 |
| **Recepción** | MX → `matumailer.matubyte.com` + alias activo + sync Postfix | Bandeja en `mail.matubyte.com` |

Puedes enviar sin recibir (solo SPF/DKIM). Para recibir correos entrantes necesitas MX correcto y el alias creado en el dashboard.

---

## 8. Plantillas del dashboard

### Crear plantilla

Dashboard → Plantillas. Variables: `{{nombre}}`, `{{codigo}}`, etc. Anota el **slug** (ej. `bienvenida`).

### Enviar

```ts
await mail.sendTemplate('usuario@ejemplo.com', 'bienvenida', {
  nombre: 'Ana',
  codigo: '48291',
});

// Equivalente
await mail.send({
  to: 'usuario@ejemplo.com',
  from: 'soporte@tudominio.com',
  template: 'bienvenida',
  data: { nombre: 'Ana', codigo: '48291' },
});
```

---

## 9. Envío masivo y grupos

### Bulk (plantilla obligatoria)

```ts
await mail.sendBulk({
  template: 'campana',
  from: 'info@tudominio.com',
  recipients: [
    { email: 'a@x.com', data: { nombre: 'Ana' } },
    { email: 'b@x.com', data: { nombre: 'Luis' } },
  ],
});
```

### Grupo de contactos

```ts
await mail.sendToGroup({
  groupId: 'uuid-del-grupo',
  template: 'campana',
  from: 'info@tudominio.com',
  data: { titulo: 'Novedades', mensaje: '…' },
});
```

---

## 10. Envío programado

```ts
await mail.send({
  to: 'cliente@ejemplo.com',
  from: 'soporte@tudominio.com',
  template: 'recordatorio',
  data: { nombre: 'Luis' },
  scheduledAt: '2026-05-25T15:00:00.000Z',
});
```

Respuesta: `{ success: true, scheduled: true, id, status: "pending", scheduledAt }`.

---

## 11. Ejemplo Next.js (API Route)

```ts
// app/api/notificar/route.ts
import { MatuMailer } from 'matumailer';
import { NextResponse } from 'next/server';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN!,
  baseUrl: process.env.MATUMAILER_API_URL,
});

export async function POST(req: Request) {
  const { email, nombre } = await req.json();

  try {
    const result = await mail.send({
      to: email,
      from: 'soporte@tudominio.com',
      template: 'bienvenida',
      data: { nombre },
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al enviar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Nunca** expongas `mm_live_...` en el navegador del usuario.

---

## 12. cURL (sin SDK)

```bash
API=https://matumailer.matubyte.com
TOKEN=mm_live_TU_TOKEN

# Con plantilla
curl -X POST "$API/api/emails/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@ejemplo.com",
    "from": "agenda@grupohuacas.com",
    "template": "bienvenida",
    "data": { "nombre": "Ana" }
  }'

# Correo libre
curl -X POST "$API/api/emails/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@ejemplo.com",
    "from": "soporte@tudominio.com",
    "subject": "Hola",
    "html": "<p>Mensaje libre</p>"
  }'

# Listar identidades de envío
curl "$API/api/sending-identities" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 13. Android / Kotlin (OkHttp)

Usa la misma URL base y el token en `Authorization: Bearer`.

```kotlin
val apiUrl = "https://matumailer.matubyte.com"
val body = JSONObject()
  .put("to", "cliente@ejemplo.com")
  .put("from", "agenda@grupohuacas.com")
  .put("subject", "Hola")
  .put("html", "<p>Mensaje</p>")

val request = Request.Builder()
  .url("$apiUrl/api/emails/send")
  .addHeader("Authorization", "Bearer mm_live_TU_TOKEN")
  .addHeader("Content-Type", "application/json")
  .post(body.toString().toRequestBody("application/json".toMediaType()))
  .build()
```

Preferible que tu **backend** proxyee el token; no lo embebas en la APK.

---

## 14. Respuestas y errores

### Éxito (envío inmediato)

```json
{
  "success": true,
  "scheduled": false,
  "id": "uuid-del-log",
  "status": "sent",
  "from": "agenda@grupohuacas.com",
  "aliasId": "uuid-alias",
  "domainId": "uuid-dominio"
}
```

### Errores habituales

| Código                         | Causa                                        | Qué hacer                                         |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------- |
| `NO_DEFAULT_SENDING_IDENTITY`  | Varios aliases, ninguno default y sin `from` | Pasa `from` o `aliasId`, o marca un alias default |
| `SENDING_IDENTITY_NOT_FOUND`   | `from` no es un alias registrado             | Créalo en Dashboard → Aliases                     |
| `SENDING_IDENTITY_DISABLED`    | Alias desactivado                            | Actívalo en Aliases                               |
| `SENDING_IDENTITY_NOT_ALLOWED` | Alias de otro proyecto                       | Usa token del proyecto correcto                   |
| `DOMAIN_NOT_VERIFIED`          | Dominio sin SPF/DKIM OK                      | Verifica DNS en Dominios                          |
| `NO_VERIFIED_DOMAIN`           | Sin dominios listos para enviar              | Añade y verifica un dominio                       |
| `TEMPLATE_NOT_FOUND`           | Slug incorrecto                              | Revisa Plantillas                                 |
| `401`                          | Token inválido                               | Genera token nuevo                                |
| `402`                          | Límite de plan                               | Upgrade o espera reset                            |
| `MISSING_TOKEN` (SDK)          | Sin token en config/env                      | Define `MATUMAILER_TOKEN`                         |

---

## 15. Checklist rápido

1. [ ] Dominio con **SPF + DKIM** verificados (badge Envío en Dominios)
2. [ ] Al menos un **alias activo** (`agenda@`, `soporte@`, etc.)
3. [ ] Token `mm_live_...` generado
4. [ ] `MATUMAILER_API_URL` apunta a tu API (`https://matumailer.matubyte.com` en MatuByte)
5. [ ] Prueba: `sendingIdentities.list()` o envío con `from` explícito
6. [ ] (Opcional recepción) MX → `matumailer.matubyte.com` + alias en bandeja

---

## 16. Más referencia

- Documentación en el dashboard → **Documentación**
- Swagger: `{BASE_URL}/docs`
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEPLOY-SERVIDOR.md](./DEPLOY-SERVIDOR.md)
- [NPM-PUBLISH.md](./NPM-PUBLISH.md)
