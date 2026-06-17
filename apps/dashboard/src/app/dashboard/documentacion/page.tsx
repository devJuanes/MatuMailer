'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';

const endpoints = [
  {
    method: 'POST',
    path: '/api/emails/send',
    desc: 'Enviar correo (token API). Libre, plantilla o programado.',
  },
  { method: 'POST', path: '/api/auth/register', desc: 'Registro MatuDB Auth' },
  { method: 'POST', path: '/api/auth/login', desc: 'Inicio de sesión' },
  { method: 'GET', path: '/api/projects', desc: 'Listar proyectos' },
  { method: 'PUT', path: '/api/smtp/:projectId', desc: 'Configurar SMTP' },
  {
    method: 'GET',
    path: '/api/templates/:projectId',
    desc: 'Listar plantillas (slug para código)',
  },
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
          </>
        }
        showProject={false}
      />

      <Card className="mb-6 border-gold/30 bg-gold/5">
        <CardHeader>
          <CardTitle>Antes de integrar en tu código</CardTitle>
          <CardDescription>Checklist por proyecto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-charcoal/80">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Configura y <strong>verifica SMTP</strong> en este proyecto.
            </li>
            <li>
              Crea un <strong>token de API</strong> (empieza por{' '}
              <code className="rounded bg-white/80 px-1">mm_live_</code>
              ). No uses tu contraseña de login.
            </li>
            <li>
              (Plantillas) Crea la plantilla en el dashboard; en código usarás su{' '}
              <strong>slug</strong> y variables{' '}
              <code className="rounded bg-white/80 px-1">{'{{nombre}}'}</code>.
            </li>
            <li>
              En cada plantilla, abre <strong>“Cómo usar esta plantilla”</strong> para ver snippets
              con tu slug real.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Instalación SDK</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`npm install matumailer`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Correo libre (HTML tuyo)</CardTitle>
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
          <CardTitle>Correo con plantilla</CardTitle>
          <CardDescription>
            Usa el <strong>slug</strong> de una plantilla de este proyecto y <code>data</code> para{' '}
            <code>{'{{variables}}'}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`await mail.sendTemplate(
  'usuario@ejemplo.com',
  'bienvenida',        // slug de la plantilla
  { nombre: 'Juan', codigo: '48291' },
);

// o equivalente:
await mail.send({
  to: 'usuario@ejemplo.com',
  template: 'bienvenida',
  data: { nombre: 'Juan', codigo: '48291' },
});`}
          </pre>
          <p className="text-sm text-muted-foreground">
            El asunto sale de la plantilla salvo que pases <code>subject</code> en <code>send</code>{' '}
            o el 4º argumento de <code>sendTemplate</code>.
          </p>
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
          <CardTitle>Variables de entorno</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
            {`MATUMAILER_TOKEN=mm_live_...
MATUMAILER_API_URL=${apiUrl}`}
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            El token solo en servidor (API routes, workers). No lo expongas en el frontend del
            cliente.
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
              <code>SMTP_NOT_CONFIGURED</code> / <code>SMTP_NOT_VERIFIED</code> — configura SMTP en
              el dashboard.
            </li>
            <li>
              <code>TEMPLATE_NOT_FOUND</code> — slug incorrecto o plantilla de otro proyecto.
            </li>
            <li>
              <code>401</code> — token revocado o incorrecto.
            </li>
          </ul>
        </CardContent>
      </Card>

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
