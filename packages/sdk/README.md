# matumailer

SDK oficial de [MatuMailer](https://mail.matucatalogo.com) para enviar correos transaccionales desde Node.js.

## Requisitos previos

1. Cuenta y **proyecto** en el [dashboard](https://mail.matucatalogo.com).
2. **SMTP** configurado y verificado en ese proyecto.
3. **Token de API** (`mm_live_...`) generado en el proyecto.

Sin SMTP verificado la API no enviará correos.

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
await mail.send({
  to: 'usuario@ejemplo.com',
  subject: 'Asunto del correo',
  html: '<h1>Hola</h1><p>Contenido que tú escribes</p>',
  text: 'Versión texto plano (opcional)',
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
| `detectSmtp(email)`                       | Sugiere preset SMTP (Gmail, Outlook, etc.)              |

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
