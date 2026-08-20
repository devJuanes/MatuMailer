'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Send, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { listDomains, type DomainRecord } from '@/lib/db/domains';
import { listAliases, type Alias } from '@/lib/db/aliases';
import { api } from '@/lib/api';

/**
 * Página estilo Postman para enviar un correo de prueba.
 *
 *  - Selector de dominio verificado (si hay varios).
 *  - Selector de alias (filtrado por el dominio elegido).
 *  - Campos típicos de una llamada al SDK / API.
 *  - Panel con el payload JSON generado en vivo.
 *  - Respuesta de la API (status, id, mensaje de error si aplica).
 *
 * Útil para QA sin tener que instalar Node ni escribir código.
 */
export default function SendTestPage() {
  const { activeId } = useProjects();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; status: number; body: unknown } | null>(null);

  const verifiedDomains = useMemo(() => domains.filter((d) => d.status === 'verified'), [domains]);

  const [form, setForm] = useState({
    domainId: '',
    aliasId: '',
    to: '',
    subject: 'Prueba desde MatuMailer',
    html: '<h1>Hola</h1><p>Este es un correo de prueba enviado desde <strong>MatuMailer</strong>.</p>',
    replyTo: '',
    cc: '',
    bcc: '',
  });

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    Promise.all([listDomains(activeId), listAliases(activeId, { activeOnly: true })])
      .then(([d, a]) => {
        setDomains(d);
        setAliases(a);
        const firstDomain = d.find((x) => x.status === 'verified');
        if (firstDomain) {
          const firstAlias = a.find((x) => x.domain_id === firstDomain.id && x.is_active);
          setForm((prev) => ({
            ...prev,
            domainId: firstDomain.id,
            aliasId: firstAlias?.id ?? '',
          }));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando datos'))
      .finally(() => setLoading(false));
  }, [activeId]);

  const filteredAliases = useMemo(
    () => aliases.filter((a) => a.domain_id === form.domainId && a.is_active),
    [aliases, form.domainId],
  );

  const payload = useMemo(() => {
    const alias = aliases.find((a) => a.id === form.aliasId);
    const body: Record<string, unknown> = {
      to: form.to
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      from: alias?.full_email,
      fromName: alias?.display_name ?? undefined,
      subject: form.subject,
      html: form.html,
      // El server infiere el projectId del token mm_live_… pero como el
      // dashboard usa JWT de MatuDB lo pasamos explícito en el body.
      projectId: activeId,
    };
    if (form.replyTo) body.replyTo = form.replyTo;
    if (form.cc)
      body.cc = form.cc
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (form.bcc)
      body.bcc = form.bcc
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (form.domainId && alias) body.domainId = form.domainId;
    return body;
  }, [form, aliases]);

  const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  async function copyPayload() {
    await navigator.clipboard.writeText(payloadJson).catch(() => undefined);
    setCopied('payload');
    setTimeout(() => setCopied(null), 1500);
  }

  async function send() {
    if (!form.to) {
      setError('Indica al menos un destinatario en `to`.');
      return;
    }
    setSending(true);
    setError('');
    setResult(null);
    try {
      // El SDK / helper `api` ya inyecta el JWT, así que lo usamos para
      // mantener una sola fuente de verdad en la autenticación.
      const body = await api<{ id: string; status: string; message?: string }>('/api/emails/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult({ ok: true, status: 200, body });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Envío falló';
      setError(msg);
      setResult({ ok: false, status: 0, body: { error: msg } });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enviar"
        description="Genera y ejecuta una llamada a la API de envío con el payload JSON visible — equivalente a usar el SDK o hacer un POST desde Postman."
      />

      {!activeId && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Selecciona un proyecto para empezar.
          </CardContent>
        </Card>
      )}

      {activeId && (
        <div className="grid max-w-6xl gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TerminalSquare className="h-5 w-5 text-gold" />
                Request builder
              </CardTitle>
              <CardDescription>
                POST <code>/api/emails/send</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando dominios y aliases…
                </div>
              )}

              {verifiedDomains.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Necesitas al menos un dominio verificado. Configúralo en{' '}
                  <a href="/dashboard/domains" className="underline">
                    Dominios
                  </a>
                  .
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Dominio</label>
                      <select
                        className="input-crextio w-full"
                        value={form.domainId}
                        onChange={(e) => {
                          const newDomain = e.target.value;
                          const firstAlias = aliases.find(
                            (a) => a.domain_id === newDomain && a.is_active,
                          );
                          setForm({ ...form, domainId: newDomain, aliasId: firstAlias?.id ?? '' });
                        }}
                      >
                        {verifiedDomains.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.domain}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Alias (from)</label>
                      <select
                        className="input-crextio w-full"
                        value={form.aliasId}
                        onChange={(e) => setForm({ ...form, aliasId: e.target.value })}
                        disabled={filteredAliases.length === 0}
                      >
                        {filteredAliases.length === 0 && (
                          <option value="">(sin aliases activos)</option>
                        )}
                        {filteredAliases.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_email}
                            {a.is_default ? ' ★ default' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">To</label>
                    <input
                      required
                      placeholder="user@gmail.com, otro@ejemplo.com"
                      value={form.to}
                      onChange={(e) => setForm({ ...form, to: e.target.value })}
                      className="input-crextio w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Separa múltiples con coma, ; o nueva línea.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asunto</label>
                    <input
                      required
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="input-crextio w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">HTML</label>
                    <textarea
                      value={form.html}
                      onChange={(e) => setForm({ ...form, html: e.target.value })}
                      className="input-crextio w-full font-mono text-xs"
                      rows={6}
                    />
                  </div>

                  <details className="rounded-2xl border border-border/40 bg-white/40 p-3 text-sm">
                    <summary className="cursor-pointer font-medium">Opcionales</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-1">
                      <div className="space-y-1">
                        <label className="text-xs">Reply-To</label>
                        <input
                          placeholder="hola@otro-dominio.com"
                          value={form.replyTo}
                          onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
                          className="input-crextio w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs">CC</label>
                        <input
                          placeholder="manager@empresa.com"
                          value={form.cc}
                          onChange={(e) => setForm({ ...form, cc: e.target.value })}
                          className="input-crextio w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs">BCC</label>
                        <input
                          placeholder="logs@empresa.com"
                          value={form.bcc}
                          onChange={(e) => setForm({ ...form, bcc: e.target.value })}
                          className="input-crextio w-full"
                        />
                      </div>
                    </div>
                  </details>

                  {error && (
                    <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>
                  )}

                  <Button variant="gold" onClick={send} disabled={sending || !form.aliasId}>
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" /> Enviar
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Payload (JSON)</CardTitle>
                  <Button size="sm" variant="secondary" onClick={copyPayload}>
                    {copied === 'payload' ? (
                      <>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-4 w-4" /> Copiar
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-2xl bg-charcoal/95 p-4 text-xs text-white">
                  {payloadJson}
                </pre>
              </CardContent>
            </Card>

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Response · HTTP {result.status}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre
                    className={
                      'overflow-x-auto rounded-2xl p-4 text-xs ' +
                      (result.ok ? 'bg-emerald-950 text-emerald-50' : 'bg-red-950 text-red-50')
                    }
                  >
                    {JSON.stringify(result.body, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
