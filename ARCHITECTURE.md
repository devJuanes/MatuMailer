# MatuMailer — Architecture

> Plataforma de email estilo Resend.com: dominios verificados, aliases
> ilimitados, DKIM automático, envío por API/SDK desde el relay local del
> propio servidor. Self-host-friendly.

## Visión general

```
┌──────────────────────────┐         ┌──────────────────────────┐
│ Dashboard (Next.js 3000) │ ──────► │ MatuMailer API (Fastify)  │
│ /dashboard/aliases       │  HTTPS  │ /api/emails/send          │
│ /dashboard/send          │ ◄────── │ /api/domains              │
│ /dashboard/domains       │   JSON  │ /api/aliases              │
└──────────────────────────┘         │ /api/matudb/* (proxy)     │
                                     └──────────┬───────────────┘
                                                │
                                       DKIM privado del dominio
                                       (clave RSA 2048 por dominio)
                                                │
                                                ▼
                                     ┌──────────────────────────┐
                                     │ Postfix local            │
                                     │ 127.0.0.1:25 send-only   │
                                     │ myhostname=matumailer     │
                                     └──────────┬───────────────┘
                                                │
                                       MX del destinatario
                                       (Gmail, Outlook, etc.)
                                                │
                                                ▼
                                     Bandeja de entrada
```

## Capas

### 1. Front (apps/dashboard)

- **Next.js 15 (App Router)** + React 19 + Tailwind.
- Autenticación: el dashboard NO usa JWT propio. Se autentica vía MatuDB
  Auth (`@devjuanes/matuclient`) — el SDK maneja el token y la sesión.
- Páginas:
  - `/dashboard/projects` — proyectos por usuario.
  - `/dashboard/domains` — agregar/verificar dominios (SPF/DKIM/DMARC/MX/return-path).
  - `/dashboard/aliases` — CRUD de aliases por dominio.
  - `/dashboard/send` — Request builder estilo Postman (genera el payload JSON del SDK).
  - `/dashboard/templates` — plantillas HTML/handlebars.
  - `/dashboard/contactos`, `/dashboard/grupos`, `/dashboard/envio-masivo`,
    `/dashboard/programados`, `/dashboard/logs`, `/dashboard/analytics`,
    `/dashboard/branding`.

### 2. API (apps/api)

- **Fastify 5** + Zod (validación) + Swagger.
- Endpoints principales:
  - `POST /api/emails/send` — envío individual o masivo (Resend-style).
  - `POST /api/domains` — agregar dominio (genera DKIM + DNS records).
  - `POST /api/domains/:id/verify` — re-verifica los registros DNS vía lookup.
  - `GET/POST/PATCH/DELETE /api/aliases` — CRUD de aliases.
  - `POST /api/matudb/*` — proxy transparente al backend MatuDB para
    evitar CORS desde el navegador.
- Cola de envíos programados: `setInterval(30s)` corre un worker que
  despacha los `scheduled_emails` cuya `scheduled_at <= now()`.
- Reporte de errores: integración opcional con MatuOps.

### 3. Database (packages/database)

- Capa fina sobre `@devjuanes/matuclient` (PostgreSQL vía MatuDB).
- **Repositorios** por tabla (`brandingRepo`, `domainsRepo`, `aliasesRepo`, etc.).
- **Schemas SQL** versionados: `schema.sql` (instalación nueva) +
  `migrate-*.sql` (migraciones incrementales para upgrades).

### 4. Shared (packages/shared)

- Zod schemas (`sendEmailSchema`, `createAliasSchema`, `createDomainSchema`, etc.).
- Tipos públicos (`Domain`, `DomainAlias`, `SmtpConfig`, `Template`, ...).
- Helpers de SMTP y deliverability (`buildDeliverabilityReport`,
  `htmlToPlainText`, `sanitizeSubject`).

### 5. SDK (`matumailer`, packages/sdk)

- Cliente npm para Node/Next.js/scripts.
- Métodos:
  ```ts
  await mail.send({ to, from?, subject, html, data, tags?, domainId? });
  await mail.sendBulk({ template, recipients, from?, domainId? });
  await mail.listDomains(projectId);
  await mail.createDomain(projectId, { domain, region });
  await mail.verifyDomain(domainId);
  await mail.listAliases(projectId, { domainId?, activeOnly? });
  await mail.createAlias(projectId, { domainId, localPart, displayName?, isDefault? });
  await mail.updateAlias(aliasId, { isActive?, isDefault?, displayName? });
  await mail.deleteAlias(aliasId);
  ```

### 6. CLI (`matumailer-cli`, packages/cli)

- `npx matumailer init`, `domains add/list/verify/default/remove`,
  `aliases list/add/remove`.

## Modelo de datos

```
mailer_projects
  id, user_id, name, slug, description, default_domain_id  ← apunta a mailer_domains

mailer_domains          ─┐
  id, project_id          │
  domain                  │  1:N
  status                  │
  dkim_selector            │
  dkim_public_key          │  ← TXT en <selector>._domainkey.<domain>
  dkim_private_key_encrypted  (cifrado AES-256-GCM)
  return_path_subdomain  ─┘

mailer_domain_aliases   ─── N:1 ─── mailer_domains
  id, domain_id
  local_part             ← parte antes del @
  full_email             ← local_part@domain (computed)
  display_name           ← "Equipo de Soporte"
  reply_to               ← opcional
  is_active
  is_default             ← UNIQUE parcial: 1 default por dominio

api_tokens             ← mm_live_... tokens por proyecto (autenticación SDK)
templates              ← HTML/handlebars con variables {{nombre}}
contacts               ← lista de contactos
contact_groups         ← segmentos
campaigns              ← envíos masivos
email_logs             ← log de cada envío (status, error, message_id)
email_events           ← aperturas/clicks (tracking)
scheduled_emails       ← cola de envíos programados
```

## Flujo de envío de un correo (sendEmail)

```
1. SDK mail.send({ to, from?, subject, html, data, domainId? })
       │
       ▼
2. POST /api/emails/send  (Authorization: Bearer <jwt de MatuDB>)
       │
       ▼
3. API: resolveFromAndDomain(projectId, { from?, domainId? })
       │
       ├─ Si from explícito: lo busca en aliases del proyecto, valida
       │  que sea activo y pertenezca a un dominio verificado.
       │
       └─ Si no: resuelve por domainId (o por default_domain_id del
          proyecto) y toma el primer alias activo del dominio.
       │
       ▼
4. Crea email_log (status='queued')
       │
       ▼
5. Prepara el contenido (template + branding + tracking pixel)
       │
       ▼
6. Construye el MIME message y firma DKIM con la clave privada del
   dominio (RSA-SHA256, relaxed/relaxed)
       │
       ▼
7. transport.sendMail() hacia 127.0.0.1:25 (Postfix local)
       │
       ▼
8. Postfix entrega vía internet al MX del destinatario.
   El destinatario valida la firma DKIM contra el TXT público en DNS.
       │
       ▼
9. email_log → status='sent', sent_at=now()
```

### Por qué DKIM se firma en Node y no en Postfix (OpenDKIM)

- Cada dominio tiene su propia clave RSA 2048. Con OpenDKIM harían falta
  un KeyTable y SigningTable por dominio y un reinicio al agregar uno nuevo.
- Firmando en Node, las claves viven cifradas en `mailer_domains.dkim_private_key_encrypted`
  y se rotan simplemente cambiando el registro (`dkim_private_key_encrypted` +
  `dkim_public_key`).

## Sistema de DKIM / DNS records

Al crear un dominio:

1. Server genera par RSA 2048 con `crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })`.
2. Guarda el privado cifrado (AES-256-GCM con `ENCRYPTION_KEY` del server).
3. Devuelve los registros DNS a publicar:
   - **SPF** (TXT en raíz): `v=spf1 include:_spf.matumailer.com ~all`
   - **DKIM** (TXT en `<selector>._domainkey.<domain>`): clave pública RSA en base64
   - **DMARC** (TXT en `_dmarc.<domain>`): `v=DMARC1; p=none; rua=mailto:dmarc-reports@matumailer.com; ...`
   - **MX** opcional (en `mx.<domain>`): apunta al relay
   - **return-path** (CNAME en `<subdomain>.<domain>`): apunta al feedback del server
4. Usuario publica esos registros en su proveedor DNS.
5. `POST /api/domains/:id/verify` hace lookup real de los registros y
   marca el dominio como `verified` solo cuando todos están presentes.

## Sistema de queues

- `scheduled_emails` (tabla): cola persistente para envíos con `scheduledAt`.
- `setInterval(30s, runScheduledWorker)`: revisa la cola y despacha.
- El envío en sí es síncrono vía Postfix (no hay queue de Postfix para entrega).
- Bounces y quejas: el log de `email_logs` captura el resultado. Un handler
  opcional puede parsear emails de bounce recibidos en `return-path_subdomain@<domain>`
  y marcar los emails como `bounced`.

## Endurecimiento (deliverability)

Para que los correos NO caigan en spam:

1. **PTR (reverse DNS)**: el hosting provider debe apuntar `13.140.160.248`
   → `mail.matumailer.matubyte.com`. Sin esto, Gmail/Outlook puntúan
   negativo automáticamente.

2. **SPF del dominio del usuario**: debe incluir la IP del server. Para
   destin.com por ejemplo:

   ```
   destin.com TXT "v=spf1 a mx ip4:13.140.160.248 include:_spf.matumailer.com ~all"
   ```

3. **DMARC alignment**: empezar con `p=none` para monitorear, luego
   `p=quarantine` o `p=reject`.

4. **Warmup de IP**: si vas a enviar volumen, empieza con pocos correos/día
   y sube gradualmente. Las primeras 1000-5000 emails son las más críticas.

5. **Headers estándar que MatuMailer ya agrega**:
   - `Message-ID` único
   - `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
   - `X-Mailer: MatuMailer`
   - DKIM-Signature con `relaxed/relaxed`
   - `Content-Type: text/html; charset=utf-8`
   - `MIME-Version: 1.0`

## Variables de entorno (server)

El API solo necesita:

```
PORT=4001
MATUDB_URL=https://db.matudb.com
MATUDB_PROJECT_ID=<uuid>
MATUDB_API_KEY=<service-role key>
JWT_SECRET=<cualquier string largo>
ENCRYPTION_KEY=<32+ caracteres para cifrar DKIM privado + SMTP passwords>
APP_URL=https://matumailer.matubyte.com   # para callbacks de billing
```

**Importante**: el front NUNCA lee variables de entorno. Solo recibe
`NEXT_PUBLIC_*` que son valores seguros (URLs, claves públicas MatuDB).

## Cómo correr localmente

```bash
# 1. Setup
npm install
cp .env.example .env   # rellenar MATUDB_*

# 2. Aplicar schema
psql "$DATUDB_URL" -f packages/database/sql/schema.sql
psql "$MATUDB_URL" -f packages/database/sql/migrate-aliases.sql  # nueva

# 3. Build
npm run build

# 4. Dev
npm run dev   # api (4001) + dashboard (3000)
```

## Migración desde SMTP propio

Si tenías SMTP configurado y quieres migrar al nuevo flujo:

1. Agrega y verifica tu dominio (`POST /api/domains`).
2. Crea aliases en el nuevo dominio (`POST /api/aliases`).
3. Marca el dominio como default (`POST /api/domains/:id/default`).
4. La tabla `smtp_configs` queda intacta pero ya no se usa.
5. Borra `smtp.routes.ts` del registro (ya hecho).

## Decisiones de diseño

- **¿Por qué un solo Postfix y no per-domain?** Postfix añade headers de
  Received, marca X-Spam-Score, etc. Tener uno solo simplifica la
  auditoría. La separación lógica por dominio se hace via DKIM.
- **¿Por qué DKIM en Node y no OpenDKIM?** OpenDKIM requiere generar
  KeyTable/SigningTable y reiniciar. Firmar en Node permite rotación de
  claves sin reinicio y centraliza la lógica.
- **¿Por qué MatuDB en vez de Prisma directo?** Reutiliza la autenticación
  y el multi-tenancy de MatuDB, sin tener que mantener un backend
  separado. Para SaaS masivo se podría sustituir por un Postgres directo,
  pero rompería la integración con MatuDB Auth.
- **¿Por qué Postfix y no nodemailer-direct?** nodemailer-direct
  funciona para testing local; Postfix es el MTA estándar que se puede
  tunear con políticas, filtros de spam y reputación.

## Performance / escalabilidad

- Cola persistente (PostgreSQL) → no se pierden envíos si el API se reinicia.
- Cola en memoria del worker con `setInterval` es O(1) por ciclo.
- Cada envío es una transacción pequeña (`email_logs` + `nodemailer.sendMail`).
- Para escala masiva: el cuello de botella es Postfix. Se puede mover a
  una queue tipo Postfix + `qmgr` con `transport_maps` por dominio
  (ej. SES para Gmail, Mailgun para Yahoo) sin tocar el código de la app.
- El proxy `/api/matudb/*` no añade latencia significativa (es un `fetch` server-to-server).
