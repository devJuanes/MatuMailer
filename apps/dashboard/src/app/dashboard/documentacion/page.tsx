'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';

const endpoints = [
  { method: 'POST', path: '/api/emails/send', desc: 'Enviar correo (token API)' },
  { method: 'POST', path: '/api/auth/register', desc: 'Registro MatuDB Auth' },
  { method: 'POST', path: '/api/auth/login', desc: 'Inicio de sesión' },
  { method: 'GET', path: '/api/projects', desc: 'Listar proyectos' },
  { method: 'PUT', path: '/api/smtp/:projectId', desc: 'Configurar SMTP' },
  { method: 'GET', path: '/api/templates/:projectId', desc: 'Listar plantillas' },
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
            <code className="rounded-full bg-charcoal/8 px-2 py-0.5 font-mono text-sm">{apiUrl}</code>
            {' · '}
            <a href={`${apiUrl}/docs`} className="font-semibold text-charcoal underline" target="_blank" rel="noreferrer">
              Swagger
            </a>
          </>
        }
        showProject={false}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>SDK matumailer</CardTitle>
          <CardDescription>Instalación y uso básico</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm text-charcoal/80">
{`npm install matumailer

import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN,
  baseUrl: '${apiUrl}',
});

await mail.send({
  to: 'usuario@ejemplo.com',
  template: 'welcome',
  data: { name: 'Juan' },
});`}
          </pre>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {endpoints.map((ep) => (
          <Card key={ep.path + ep.method}>
            <CardContent className="p-5">
              <span
                className={`inline-block rounded-full px-3 py-1 font-mono text-xs font-bold ${
                  ep.method === 'GET'
                    ? 'bg-charcoal/10 text-charcoal'
                    : 'bg-gold/30 text-charcoal'
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
