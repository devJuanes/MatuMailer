'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';

const endpoints = [
  {
    method: 'POST',
    path: '/api/emails/send',
    desc: 'Enviar correo (token API). Libre, plantilla o programado.',
  },
  {
    method: 'POST',
    path: '/api/emails/send/bulk',
    desc: 'Envío masivo: un correo individual por destinatario (privacidad).',
  },
  {
    method: 'POST',
    path: '/api/emails/send/bulk-from-json',
    desc: 'Envío masivo desde JSON de usuarios (objeto o array).',
  },
  {
    method: 'POST',
    path: '/api/emails/send/group',
    desc: 'Enviar plantilla a un grupo de contactos (inmediato o programado).',
  },
  {
    method: 'GET',
    path: '/api/templates',
    desc: 'Listar plantillas del proyecto (token API).',
  },
  {
    method: 'GET',
    path: '/api/templates/slug/:slug',
    desc: 'Obtener plantilla por slug (token API).',
  },
  {
    method: 'POST',
    path: '/api/templates',
    desc: 'Crear plantilla (token API). Body: slug, name, subject, htmlContent, variables.',
  },
  {
    method: 'PATCH',
    path: '/api/templates/id/:templateId',
    desc: 'Actualizar plantilla (token API).',
  },
  {
    method: 'DELETE',
    path: '/api/templates/id/:templateId',
    desc: 'Eliminar plantilla (token API).',
  },
  { method: 'POST', path: '/api/auth/register', desc: 'Registro MatuDB Auth' },
  { method: 'POST', path: '/api/auth/login', desc: 'Inicio de sesión' },
  { method: 'GET', path: '/api/projects', desc: 'Listar proyectos (sesión dashboard)' },
  { method: 'GET', path: '/api/sending-identities', desc: 'Aliases listos para enviar (token API)' },
  {
    method: 'GET',
    path: '/api/sending-identities/:id',
    desc: 'Detalle de una identidad lista para enviar',
  },
  { method: 'GET', path: '/api/domains', desc: 'Dominios del proyecto' },
  { method: 'GET', path: '/api/aliases', desc: 'Aliases / identidades de envío' },
  { method: 'GET', path: '/t/o/:token', desc: 'Pixel de apertura (tracking)' },
  { method: 'GET', path: '/t/c/:token?u=', desc: 'Redirect de clic trackeado' },
];

export default function DocsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

  return (
    <div>
      <PageHeader
        title="Documentación API"
        description={
          <>
            Base:{' '}
            <code className="rounded-full bg-charcoal/8 px-2 py-0.5 font-mono text-sm">
              {apiUrl}
            </code>
            {' · '}
            <a
              href={`${apiUrl}/docs`}
              className="font-semibold text-charcoal underline"
              target="_blank"
              rel="noreferrer"
            >
              Swagger
            </a>
            {' · Lista para Android, cURL, Node y cualquier cliente HTTP'}
          </>
        }
        showProject={false}
      />

      <Card className="mb-6 border-gold/30 bg-gold/5">
        <CardHeader>
          <CardTitle>Antes de integrar</CardTitle>
          <CardDescription>Checklist por proyecto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-charcoal/80">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Verifica un <strong>dominio por DNS</strong> y crea al menos un <strong>alias</strong>.
            </li>
            <li>
              Crea un <strong>token de API</strong> (empieza por{' '}
              <code className="rounded bg-white/80 px-1">mm_live_</code>
              ). No uses tu contraseña de login.
            </li>
            <li>
              Autentica todas las llamadas con{' '}
              <code className="rounded bg-white/80 px-1">Authorization: Bearer mm_live_...</code>
            </li>
            <li>
              El proyecto se toma del token: no hace falta pasar <code>projectId</code> en send /
              templates API.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card className="mb-6 border-charcoal/10">
        <CardHeader>
          <CardTitle>Android / Kotlin (OkHttp)</CardTitle>
          <CardDescription>
            Desde Android no uses el SDK npm: llama a la API REST con tu token. Guarda el token en
            el servidor o en almacenamiento seguro — no lo subas a Play Store en texto plano.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-xs leading-relaxed text-charcoal/80 sm:text-sm">
            {`// build.gradle.kts → implementation("com.squareup.okhttp3:okhttp:4.12.0")

val client = OkHttpClient()
val apiUrl = "${apiUrl}"
val token = "mm_live_TU_TOKEN" // idealmente desde tu backend

fun sendEmail(to: String, template: String, data: JSONObject) {
  val body = JSONObject()
    .put("to", to)
    .put("template", template)
    .put("data", data)
    .toString()
    .toRequestBody("application/json".toMediaType())

  val request = Request.Builder()
    .url(apiUrl + "/api/emails/send")
    .addHeader("Authorization", "Bearer " + token)
    .addHeader("Content-Type", "application/json")
    .post(body)
    .build()

  client.newCall(request).enqueue(object : Callback {
    override fun onResponse(call: Call, response: Response) {
      val json = response.body?.string()
      // { "success": true, "id": "...", "status": "sent" }
    }
    override fun onFailure(call: Call, e: IOException) { /* ... */ }
  })
}

// Ejemplo:
sendEmail(
  "pepito@mail.com",
  "campana",
  JSONObject()
    .put("primerNombre", "Pepito")
    .put("titulo", "Novedades")
    .put("mensaje", "Hola, solo tú ves este correo.")
    .put("enlace", "https://tudominio.com")
)`}
          </pre>

          <p className="text-sm font-medium text-charcoal">
            Envío masivo (privacidad: 1 correo por persona)
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-xs leading-relaxed text-charcoal/80 sm:text-sm">
            {`val body = JSONObject()
  .put("template", "campana")
  .put("recipients", JSONArray()
    .put(JSONObject()
      .put("email", "a@x.com")
      .put("data", JSONObject().put("nombre", "Ana").put("titulo", "Hola")))
    .put(JSONObject()
      .put("email", "b@x.com")
      .put("data", JSONObject().put("nombre", "Luis").put("titulo", "Hola")))
  )
  .toString()
  .toRequestBody("application/json".toMediaType())

val request = Request.Builder()
  .url("${apiUrl}/api/emails/send/bulk")
  .addHeader("Authorization", "Bearer " + token)
  .post(body)
  .build()`}
          </pre>

          <p className="text-sm font-medium text-charcoal">Crear plantilla desde la app</p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-xs leading-relaxed text-charcoal/80 sm:text-sm">
            {`val body = JSONObject()
  .put("slug", "aviso-app")
  .put("name", "Aviso desde app")
  .put("subject", "Hola, {{nombre}}")
  .put("htmlContent", "<h1>Hola {{nombre}}</h1><p>{{mensaje}}</p>")
  .put("variables", JSONArray().put("nombre").put("mensaje"))
  .toString()
  .toRequestBody("application/json".toMediaType())

val request = Request.Builder()
  .url("${apiUrl}/api/templates")
  .addHeader("Authorization", "Bearer " + token)
  .post(body)
  .build()`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>cURL (cualquier plataforma)</CardTitle>
          <CardDescription>Ideal para probar desde terminal o Postman</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium text-charcoal">Enviar con plantilla</p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-xs text-charcoal/80 sm:text-sm">
            {`curl -X POST ${apiUrl}/api/emails/send \\
  -H "Authorization: Bearer mm_live_TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "usuario@ejemplo.com",
    "template": "campana",
    "data": {
      "primerNombre": "Juan",
      "titulo": "Novedades",
      "mensaje": "Solo tú recibes este correo.",
      "enlace": "https://ejemplo.com"
    }
  }'`}
          </pre>

          <p className="text-sm font-medium text-charcoal">Correo libre (HTML)</p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-xs text-charcoal/80 sm:text-sm">
            {`curl -X POST ${apiUrl}/api/emails/send \\
  -H "Authorization: Bearer mm_live_TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "usuario@ejemplo.com",
    "subject": "Confirmación",
    "html": "<h1>Gracias</h1><p>Pedido #1234</p>"
  }'`}
          </pre>

          <p className="text-sm font-medium text-charcoal">Envío masivo</p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-xs text-charcoal/80 sm:text-sm">
            {`curl -X POST ${apiUrl}/api/emails/send/bulk \\
  -H "Authorization: Bearer mm_live_TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template": "campana",
    "recipients": [
      { "email": "a@x.com", "data": { "nombre": "Ana", "titulo": "Hola", "mensaje": "…", "enlace": "https://…" } },
      { "email": "b@x.com", "data": { "nombre": "Luis", "titulo": "Hola", "mensaje": "…", "enlace": "https://…" } }
    ]
  }'`}
          </pre>

          <p className="text-sm font-medium text-charcoal">Listar / crear plantillas</p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-xs text-charcoal/80 sm:text-sm">
            {`# Listar
curl ${apiUrl}/api/templates \\
  -H "Authorization: Bearer mm_live_TU_TOKEN"

# Crear
curl -X POST ${apiUrl}/api/templates \\
  -H "Authorization: Bearer mm_live_TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "mi-aviso",
    "name": "Mi aviso",
    "subject": "Hola {{nombre}}",
    "htmlContent": "<p>Hola {{nombre}}, {{mensaje}}</p>",
    "variables": ["nombre", "mensaje"]
  }'

# Por slug
curl ${apiUrl}/api/templates/slug/mi-aviso \\
  -H "Authorization: Bearer mm_live_TU_TOKEN"`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Instalación SDK (Node.js)</CardTitle>
          <CardDescription>
            Solo para backends Node / Next.js — no aplica en Android
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`npm install matumailer`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Correo libre (HTML tuyo) — SDK</CardTitle>
          <CardDescription>Sin plantilla del dashboard — tú envías subject y html</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN,
  baseUrl: '${apiUrl}',
});

await mail.send({
  to: 'usuario@ejemplo.com',
  subject: 'Confirmación de pedido',
  html: '<h1>Gracias</h1><p>Tu pedido #1234 está confirmado.</p>',
  text: 'Gracias. Pedido #1234 confirmado.', // opcional
});`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Correo con plantilla — SDK</CardTitle>
          <CardDescription>
            Usa el <strong>slug</strong> de una plantilla y <code>data</code> para{' '}
            <code>{'{{variables}}'}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`await mail.sendTemplate(
  'usuario@ejemplo.com',
  'bienvenida',
  { nombre: 'Juan', codigo: '48291' },
);

await mail.send({
  to: 'usuario@ejemplo.com',
  template: 'bienvenida',
  data: { nombre: 'Juan', codigo: '48291' },
});`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Envío programado</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`await mail.send({
  to: 'usuario@ejemplo.com',
  template: 'recordatorio',
  data: { nombre: 'Ana' },
  scheduledAt: '2026-05-25T15:00:00.000Z',
});`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Envío a grupo</CardTitle>
          <CardDescription>
            Requiere contactos y grupos en el dashboard. Un correo por miembro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`await mail.sendToGroup({
  groupId: 'uuid-del-grupo',
  template: 'campana',
  data: { titulo: 'Novedades', mensaje: 'Hola…', enlace: 'https://…' },
});`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bulk / masivo</CardTitle>
          <CardDescription>
            Cada destinatario recibe su propio correo; nadie ve los emails de los demás.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`await mail.sendBulk({
  template: 'campana',
  recipients: [
    { email: 'a@x.com', data: { nombre: 'Ana' } },
    { email: 'b@x.com', data: { nombre: 'Luis' } },
  ],
});`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Variables de entorno</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`MATUMAILER_TOKEN=mm_live_...
MATUMAILER_API_URL=${apiUrl}`}
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            En Android: usa la misma URL base y el token en el header Bearer. Preferible que tu
            backend Android proxyee las llamadas para no embeber el token en la APK.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Errores frecuentes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-charcoal/80">
            <li>
              <code>NO_VERIFIED_DOMAIN</code> / <code>NO_DEFAULT_SENDING_IDENTITY</code> — verifica
              el dominio, crea aliases y marca un remitente predeterminado.
            </li>
            <li>
              <code>TEMPLATE_NOT_FOUND</code> — slug incorrecto o plantilla de otro proyecto.
            </li>
            <li>
              <code>401</code> — token revocado o incorrecto. Debe ser <code>mm_live_...</code>, no
              el JWT de login.
            </li>
            <li>
              <code>SLUG_EXISTS</code> — ya hay una plantilla con ese slug en el proyecto.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-charcoal">Endpoints</h2>
        <p className="text-sm text-muted-foreground">
          Con token API el proyecto se resuelve solo. Swagger: {apiUrl}/docs
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {endpoints.map((ep) => (
          <Card key={ep.path + ep.method}>
            <CardContent className="p-5">
              <span
                className={`inline-block rounded-full px-3 py-1 font-mono text-xs font-bold ${
                  ep.method === 'GET' ? 'bg-charcoal/10 text-charcoal' : 'bg-gold/30 text-charcoal'
                }`}
              >
                {ep.method}
              </span>
              <code className="mt-3 block font-mono text-sm text-charcoal">{ep.path}</code>
              <p className="mt-2 text-sm text-muted-foreground">{ep.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
