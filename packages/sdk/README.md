# matumailer

SDK oficial de [MatuMailer](https://mail.matubyte.com) para enviar correos transaccionales desde Node.js.

## Requisitos previos

1. Cuenta y **proyecto** en el [dashboard](https://matumailer.matubyte.com).
2. **Dominio verificado para envío** (SPF + DKIM en DNS) y al menos un **alias activo** (ej. `soporte@tudominio.com`).
3. **Token de API** (`mm_live_...`) generado en el proyecto.

> El campo `from` debe ser un **alias registrado y activo**, no cualquier dirección del dominio. Si tienes un solo alias (o uno marcado como default), puedes omitir `from`.

## Instalación

```bash
npm install matumailer
```

## Configuración

```ts
import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN!,
  // MatuByte: https://matumailer.matubyte.com
  // MatuCatalogo (default npm): https://api.matucatalogo.com
  baseUrl: process.env.MATUMAILER_API_URL,
});
```

| Variable             | Descripción                               |
| -------------------- | ----------------------------------------- |
| `MATUMAILER_TOKEN`   | Token de API del proyecto (`mm_live_...`) |
| `MATUMAILER_API_URL` | URL base de la API, sin `/api` (opcional) |

---

## Identidades de envío (aliases)

```ts
// Ver qué direcciones puedes usar como `from`
const { identities } = await mail.sendingIdentities.list();
console.log(identities.map((i) => i.email));

// Enviar con alias explícito
await mail.send({
  to: 'usuario@ejemplo.com',
  from: 'agenda@grupohuacas.com',
  fromName: 'Agenda', // opcional
  subject: 'Confirmación',
  html: '<p>Tu cita está confirmada.</p>',
});

// O con aliasId (UUID)
await mail.send({
  to: 'usuario@ejemplo.com',
  aliasId: 'uuid-del-alias',
  subject: 'Hola',
  html: '<p>...</p>',
});
```

`listAliases()` y `listDomains()` funcionan con token API. **Crear** dominios/aliases requiere sesión del dashboard (JWT), no `mm_live_`.

---

## Correo libre (HTML propio)

```ts
await mail.send({
  to: 'usuario@ejemplo.com',
  from: 'soporte@tudominio.com',
  subject: 'Asunto',
  html: '<h1>Hola</h1>',
  text: 'Versión texto (opcional)',
  replyTo: 'ventas@tudominio.com',
  cc: ['copia@ejemplo.com'],
});
```

Varios destinatarios: `to: ['a@x.com', 'b@x.com']` (un correo por persona).

---

## Plantillas

```ts
await mail.sendTemplate('usuario@ejemplo.com', 'bienvenida', {
  nombre: 'Ana',
  codigo: '12345',
});

await mail.send({
  to: 'usuario@ejemplo.com',
  from: 'soporte@tudominio.com',
  template: 'bienvenida',
  data: { nombre: 'Ana', codigo: '12345' },
});
```

---

## Bulk, grupos y programado

```ts
await mail.sendBulk({
  template: 'campana',
  from: 'info@tudominio.com',
  recipients: [{ email: 'a@x.com', data: { nombre: 'Ana' } }],
});

await mail.sendToGroup({
  groupId: 'uuid-grupo',
  template: 'campana',
  data: { titulo: 'Novedades' },
});

await mail.send({
  to: 'usuario@ejemplo.com',
  from: 'soporte@tudominio.com',
  template: 'recordatorio',
  scheduledAt: '2026-05-25T15:00:00.000Z',
  data: { nombre: 'Luis' },
});
```

---

## API del SDK

| Método                                    | Descripción                   |
| ----------------------------------------- | ----------------------------- |
| `send(payload)`                           | POST `/api/emails/send`       |
| `sendTemplate(to, slug, data?, subject?)` | Atajo con plantilla           |
| `sendBulk(payload)`                       | POST `/api/emails/send/bulk`  |
| `sendBulkFromJson(payload)`               | Bulk desde JSON               |
| `sendToGroup(payload)`                    | POST `/api/emails/send/group` |
| `sendingIdentities.list()`                | Aliases listos para enviar    |
| `sendingIdentities.get(id)`               | Detalle de identidad          |
| `domains.list()` / `aliases.list()`       | Lectura con token API         |

### `SendEmailPayload` (campos principales)

| Campo                                     | Tipo                 | Uso                                          |
| ----------------------------------------- | -------------------- | -------------------------------------------- |
| `to`                                      | `string \| string[]` | Destinatario(s)                              |
| `from`                                    | `string?`            | Alias registrado (ej. `soporte@dominio.com`) |
| `aliasId`                                 | `string?`            | UUID del alias (alternativa a `from`)        |
| `domainId`                                | `string?`            | Forzar dominio si hay varios                 |
| `fromName`                                | `string?`            | Nombre visible del remitente                 |
| `subject`, `html`, `text`                 |                      | Correo libre                                 |
| `template`, `data`                        |                      | Plantilla del dashboard                      |
| `scheduledAt`                             | `string?`            | ISO 8601                                     |
| `replyTo`, `cc`, `bcc`, `headers`, `tags` |                      | Opcionales                                   |

---

## Guía completa

Paso a paso, cURL, Android, errores y recepción: **[SDK-GUIDE.md](../../SDK-GUIDE.md)**.
