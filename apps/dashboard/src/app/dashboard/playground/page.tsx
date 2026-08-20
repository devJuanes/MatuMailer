'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Play, Copy, Check } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjects } from '@/hooks/use-project';
import { listAliases, type Alias } from '@/lib/db/aliases';
import { api, API_URL, getToken } from '@/lib/api';

type Mode = 'html' | 'welcome' | 'password-recovery' | 'notification';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'html', label: 'HTML libre', hint: 'Envío con html/text y parámetros libres' },
  {
    id: 'welcome',
    label: 'Plantilla welcome',
    hint: 'Bienvenida: nombre, enlace, logo…',
  },
  {
    id: 'password-recovery',
    label: 'Plantilla password-recovery',
    hint: 'Restablecer contraseña: nombre, resetLink…',
  },
  {
    id: 'notification',
    label: 'Plantilla notification',
    hint: 'Aviso genérico: titulo, mensaje…',
  },
];

export default function PlaygroundPage() {
  const { activeId } = useProjects();
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [mode, setMode] = useState<Mode>('welcome');
  const [apiToken, setApiToken] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('Prueba Batch Manager');
  const [nombre, setNombre] = useState('Cliente');
  const [enlace, setEnlace] = useState('https://matumailer.matubyte.com');
  const [resetLink, setResetLink] = useState('https://app.ejemplo.com/reset?token=abc');
  const [titulo, setTitulo] = useState('Novedad');
  const [mensaje, setMensaje] = useState('Tu cuenta está lista.');
  const [html, setHtml] = useState(
    '<h1>Hola {{nombre}}</h1><p>Mensaje de prueba desde Batch Manager.</p>',
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeId) return;
    listAliases(activeId, { activeOnly: true })
      .then((rows) => {
        setAliases(rows);
        if (rows[0]) setFrom(rows[0].full_email);
      })
      .catch(() => undefined);
  }, [activeId]);

  const payload = useMemo(() => {
    if (mode === 'html') {
      return {
        to,
        from,
        subject,
        html: html.replace(/\{\{nombre\}\}/g, nombre),
        data: { nombre },
        projectId: activeId,
      };
    }
    if (mode === 'welcome') {
      return {
        to,
        from,
        template: 'welcome',
        data: { nombre, enlace, companyName: 'MatuMailer' },
        projectId: activeId,
      };
    }
    if (mode === 'password-recovery') {
      return {
        to,
        from,
        template: 'password-recovery',
        data: { nombre, resetLink, companyName: 'MatuMailer' },
        projectId: activeId,
      };
    }
    return {
      to,
      from,
      template: 'notification',
      data: { titulo, mensaje, companyName: 'MatuMailer' },
      projectId: activeId,
    };
  }, [mode, to, from, subject, html, nombre, enlace, resetLink, titulo, mensaje, activeId]);

  const sdkSnippet = useMemo(() => {
    if (mode === 'html') {
      return `import { MatuMailer } from 'matumailer';

const mailer = new MatuMailer('${apiToken || 'mm_live_…'}');

await mailer.send({
  to: '${to || 'usuario@cliente.com'}',
  from: '${from || 'info@tudominio.com'}',
  subject: '${subject}',
  html: \`${html.replace(/`/g, '\\`')}\`,
});`;
    }
    const data =
      mode === 'welcome'
        ? `{ nombre: '${nombre}', enlace: '${enlace}' }`
        : mode === 'password-recovery'
          ? `{ nombre: '${nombre}', resetLink: '${resetLink}' }`
          : `{ titulo: '${titulo}', mensaje: '${mensaje}' }`;
    return `import { MatuMailer } from 'matumailer';

const mailer = new MatuMailer('${apiToken || 'mm_live_…'}');

await mailer.sendTemplate(
  '${to || 'usuario@cliente.com'}',
  '${mode}',
  ${data},
);`;
  }, [mode, apiToken, to, from, subject, html, nombre, enlace, resetLink, titulo, mensaje]);

  async function runSend() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      if (!to || !from) throw new Error('Completa Para y Desde');
      const token = apiToken.trim() || getToken();
      const res = await api('/api/emails/send', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Manager / Playground"
        description="Prueba envíos vía API o SDK con plantillas (welcome, password-recovery) y HTML libre. Ideal para integrar desde tu app."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
            <CardDescription>
              API: <code className="text-xs">{API_URL}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    mode === m.id
                      ? 'bg-charcoal text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {MODES.find((m) => m.id === mode)?.hint}
            </p>

            <label className="block text-sm">
              Token API (opcional; si vacío usa tu sesión)
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="mm_live_…"
              />
            </label>
            <label className="block text-sm">
              Desde (alias)
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                {aliases.map((a) => (
                  <option key={a.id} value={a.full_email}>
                    {a.full_email}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Para
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="cliente@empresa.com"
              />
            </label>

            {mode === 'html' && (
              <>
                <label className="block text-sm">
                  Asunto
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  HTML
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs"
                    rows={6}
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                  />
                </label>
              </>
            )}

            {(mode === 'welcome' || mode === 'password-recovery' || mode === 'html') && (
              <label className="block text-sm">
                nombre
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </label>
            )}
            {mode === 'welcome' && (
              <label className="block text-sm">
                enlace
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={enlace}
                  onChange={(e) => setEnlace(e.target.value)}
                />
              </label>
            )}
            {mode === 'password-recovery' && (
              <label className="block text-sm">
                resetLink
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={resetLink}
                  onChange={(e) => setResetLink(e.target.value)}
                />
              </label>
            )}
            {mode === 'notification' && (
              <>
                <label className="block text-sm">
                  titulo
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  mensaje
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                  />
                </label>
              </>
            )}

            <Button onClick={() => void runSend()} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Enviar prueba
            </Button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {result != null && (
              <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>SDK / embed</CardTitle>
              <CardDescription>Copia este snippet en tu aplicación</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={async () => {
                await navigator.clipboard.writeText(sdkSnippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copiar
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-lg bg-charcoal p-4 text-xs leading-relaxed text-gold/90">
              {sdkSnippet}
            </pre>
            <p className="mt-4 text-xs text-muted-foreground">
              Payload JSON que se envía a <code>POST /api/emails/send</code>:
            </p>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
