# matumailer

SDK oficial de [MatuMailer](https://mail.matucatalogo.com) para enviar correos transaccionales desde Node.js.

## Requisitos previos

1. Cuenta y **proyecto** en el [dashboard](https://mail.matucatalogo.com).
2. **Dominio verificado por DNS** (DKIM + SPF) y al menos un **alias activo** (ej: `soporte@tudominio.com`).
3. **Token de API** (`mm_live_...`) generado en el proyecto.

*Nota:* Si tienes un solo dominio y alias, MatuMailer enviará automáticamente desde ese correo sin necesidad de especificar `from`. Si tienes múltiples aliases, puedes indicar `from: 'ventas@tudominio.com'`.

## Instalación

```bash
npm install matumailer
```

## Configuración

```ts
import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN!,
  // baseUrl opcional; por defecto https://api.matucatalogo.com
});
```

| Variable             | Descripción                   |
| -------------------- | ----------------------------- |
| `MATUMAILER_TOKEN`   | Token de API del proyecto     |
| `MATUMAILER_API_URL` | URL base de la API (opcional) |

---

## Correo libre (HTML propio)

```ts
// Envío con alias por defecto:
await mail.emails.send({
  to: 'usuario@ejemplo.com',
  subject: 'Asunto del correo',
  html: '<h1>Hola</h1><p>Contenido que tú escribes</p>',
  text: 'Versión texto plano (opcional)',
});

// O indicando un alias específico:
await mail.send({
  from: 'soporte@tudominio.com',
  fromName: 'Soporte al Cliente',
  to: 'usuario@ejemplo.com',
  subject: 'Asunto del correo',
  html: '<h1>Hola</h1><p>Contenido que tú escribes</p>',
});
```

Varios destinatarios: `to: ['a@x.com', 'b@x.com']`.

---

## Plantillas del dashboard

En el dashboard creas la plantilla con variables `{{nombre}}`, `{{codigo}}`, etc. El **slug** (ej. `bienvenida`) es el identificador en código.

```ts
// Atajo
await mail.sendTemplate('usuario@ejemplo.com', 'bienvenida', {
  nombre: 'Ana',
  codigo: '12345',
});

// Equivalente
await mail.send({
  to: 'usuario@ejemplo.com',
  template: 'bienvenida',
  data: { nombre: 'Ana', codigo: '12345' },
});
```

Puedes sobrescribir el asunto con el 4º argumento de `sendTemplate` o con `subject` en `send`.

---

## Envío a grupo

```ts
await mail.sendToGroup({
  groupId: 'uuid-del-grupo',
  template: 'campana',
  data: { titulo: 'Novedades', mensaje: '…', enlace: 'https://…' },
});
```

Con `scheduledAt` se crean N jobs durables en la cola (sobreviven reinicios).

---

## Envío programado

```ts
await mail.send({
  to: 'usuario@ejemplo.com',
  template: 'recordatorio',
  data: { nombre: 'Luis' },
  scheduledAt: '2026-05-25T15:00:00.000Z',
});
```

---

## API del SDK

| Método                                    | Descripción                                             |
| ----------------------------------------- | ------------------------------------------------------- |
| `send(payload)`                           | POST `/api/emails/send` — libre, plantilla o programado |
| `sendTemplate(to, slug, data?, subject?)` | Envío con plantilla                                     |
| `sendBulk(payload)`                       | POST `/api/emails/send/bulk`                            |
| `sendBulkFromJson(payload)`               | Bulk desde JSON de usuarios                             |
| `sendToGroup(payload)`                    | POST `/api/emails/send/group`                           |
| `sendingIdentities.list()`                | GET `/api/sending-identities`                           |
| `sendingIdentities.get(id)`               | GET `/api/sending-identities/:id`                       |
| `domains.list()` / `aliases.list()`       | Dominios y aliases del proyecto                         |

### `SendEmailPayload`

| Campo         | Tipo                 | Uso                                  |
| ------------- | -------------------- | ------------------------------------ |
| `to`          | `string \| string[]` | Destinatario(s)                      |
| `subject`     | `string?`            | Asunto (obligatorio en correo libre) |
| `html`        | `string?`            | HTML libre                           |
| `text`        | `string?`            | Texto plano                          |
| `template`    | `string?`            | Slug de plantilla                    |
| `data`        | `object?`            | Variables `{{key}}` de la plantilla  |
| `scheduledAt` | `string?`            | Fecha ISO para programar             |

---

## Guía completa (español)

Paso a paso, ejemplos Next.js, cURL y errores: **[SDK-GUIDE.md](../../SDK-GUIDE.md)** en el repositorio.

## Publicar en npm

Ver [NPM-PUBLISH.md](../../NPM-PUBLISH.md).
