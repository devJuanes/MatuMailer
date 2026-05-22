'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  slug: string;
  variables: string[];
  projectSlug?: string;
}

export function TemplateUsageDocs({ slug, variables, projectSlug = 'mi-proyecto' }: Props) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
  const dataExample =
    variables.length > 0
      ? JSON.stringify(
          Object.fromEntries(variables.map((v) => [v, v === 'resetLink' ? 'https://app.com/reset?token=abc' : 'valor'])),
          null,
          2,
        )
      : '{}';

  const sdkSnippet = `import { MatuMailer } from 'matumailer';

const mailer = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN!,
  baseUrl: '${apiUrl}',
});

await mailer.sendTemplate(
  'cliente@ejemplo.com',
  '${slug}',
  ${dataExample.replace(/\n/g, '\n  ')},
);`;

  const curlSnippet = `curl -X POST ${apiUrl}/api/emails/send \\
  -H "Authorization: Bearer TU_TOKEN_API" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "cliente@ejemplo.com",
    "template": "${slug}",
    "data": ${dataExample.replace(/\n/g, '')}
  }'`;

  const formSnippet = `<form action="${apiUrl}/api/emails/send" method="POST">
  <input type="hidden" name="template" value="${slug}" />
  <input type="email" name="to" placeholder="Correo destino" required />
${variables
  .map(
    (v) =>
      `  <label>${v}</label>\n  <input type="text" name="data[${v}]" placeholder="{{${v}}}" />`,
  )
  .join('\n')}
  <button type="submit">Enviar correo</button>
</form>
<!-- En producción usa fetch/SDK con token Bearer, no expongas el token en HTML -->`;

  return (
    <Card className="border-gold/20 bg-gold/5">
      <CardHeader>
        <CardTitle className="text-base">Cómo usar esta plantilla</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Proyecto <strong>{projectSlug}</strong> · plantilla <code className="rounded bg-white/80 px-1">/{slug}</code>
          {variables.length > 0 && (
            <>
              {' '}
              · variables: {variables.map((v) => `{{${v}}}`).join(', ')}
            </>
          )}
        </p>
        <div>
          <p className="mb-1 font-medium text-charcoal">SDK (Node.js)</p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/90 p-4 text-xs text-gold/90">{sdkSnippet}</pre>
        </div>
        <div>
          <p className="mb-1 font-medium text-charcoal">cURL</p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/90 p-4 text-xs text-gold/90">{curlSnippet}</pre>
        </div>
        <div>
          <p className="mb-1 font-medium text-charcoal">Formulario HTML (ejemplo)</p>
          <pre className="overflow-x-auto rounded-2xl bg-white/80 p-4 text-xs text-charcoal">{formSnippet}</pre>
        </div>
      </CardContent>
    </Card>
  );
}
