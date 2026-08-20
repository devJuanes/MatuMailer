'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PlanLimitBanner } from '@/components/billing/PlanLimitBanner';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { useProjects } from '@/hooks/use-project';
import { usePlan } from '@/providers/plan-provider';
import { api } from '@/lib/api';
import { canSendEmail, canSendTestEmail, FREE_LIMITS, limitMessage } from '@/lib/plan-limits-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Send, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listAliases, type Alias } from '@/lib/db/aliases';

interface DeliverabilityReport {
  score: number;
  checks: { id: string; ok: boolean; label: string; detail: string }[];
  tips: string[];
}

interface Template {
  id: string;
  slug: string;
  name: string;
  variables?: string[];
}

type SendMode = 'template' | 'custom';

export default function CorreoPruebaPage() {
  const { activeId } = useProjects();
  const { plan, isPremium, refresh: refreshPlan } = usePlan();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [aliasId, setAliasId] = useState('');
  const [mode, setMode] = useState<SendMode>('template');
  const [to, setTo] = useState('');
  const [template, setTemplate] = useState('welcome');
  const [dataJson, setDataJson] = useState('{"nombre":"Prueba"}');
  const [subject, setSubject] = useState('Correo de prueba — MatuMailer');
  const [html, setHtml] = useState(
    '<h1>Hola</h1><p>Este es un correo de prueba enviado desde el panel.</p>',
  );
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [analyze, setAnalyze] = useState<DeliverabilityReport | null>(null);

  const testUsed = plan?.usage.testEmails ?? 0;
  const emailUsed = plan?.usage.emailsInWindow ?? 0;
  const testLimit = plan?.limits?.maxTestEmails ?? FREE_LIMITS.maxTestEmails;
  const emailLimit = plan?.limits?.maxEmailsPerWindow ?? FREE_LIMITS.maxEmailsPerWindow;
  const windowHours = plan?.limits?.emailWindowHours ?? FREE_LIMITS.emailWindowHours;
  const allowTest = canSendTestEmail(plan, isPremium, testUsed);
  const allowSend = canSendEmail(plan, isPremium, emailUsed);
  const canSendNow = allowTest && allowSend;
  const selectedAlias = aliases.find((a) => a.id === aliasId);

  useEffect(() => {
    if (!activeId) return;
    api<{ templates: Template[] }>(`/api/templates/${activeId}`).then((r) => {
      setTemplates(r.templates);
      if (r.templates[0]) setTemplate(r.templates[0].slug);
    });
    listAliases(activeId, { activeOnly: true }).then((rows) => {
      setAliases(rows);
      const preferred = rows.find((a) => a.is_default) ?? rows[0];
      setAliasId(preferred?.id ?? '');
    });
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const t = setTimeout(() => {
      const body: Record<string, unknown> =
        mode === 'template'
          ? {
              template,
              data: (() => {
                try {
                  return JSON.parse(dataJson);
                } catch {
                  return {};
                }
              })(),
              ...(subject.trim() ? { subject } : {}),
            }
          : { subject, html };
      api<{ report: DeliverabilityReport }>(`/api/emails/${activeId}/analyze`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
        .then((r) => setAnalyze(r.report))
        .catch(() => setAnalyze(null));
    }, 500);
    return () => clearTimeout(t);
  }, [activeId, mode, template, subject, html, dataJson]);

  async function sendTest() {
    if (!activeId || !to || !canSendNow || !aliasId) return;
    setSending(true);
    setMessage('');
    try {
      const body: Record<string, unknown> = {
        to,
        aliasId,
        ...(selectedAlias ? { from: selectedAlias.full_email } : {}),
      };
      if (mode === 'template') {
        let data = {};
        try {
          data = JSON.parse(dataJson);
        } catch {
          setMessage('JSON de variables inválido');
          setSending(false);
          return;
        }
        body.template = template;
        body.data = data;
        if (subject.trim()) body.subject = subject;
      } else {
        body.subject = subject;
        body.html = html;
      }
      await api(`/api/emails/${activeId}/test`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setMessage('Correo de prueba enviado correctamente');
      await refreshPlan();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al enviar';
      if (msg.includes('Premium') || msg.includes('gratis') || msg.includes('Límite')) {
        setMessage(msg);
      } else if (
        msg.includes('NO_VERIFIED_DOMAIN') ||
        msg.includes('DOMAIN_NOT_VERIFIED') ||
        msg.includes('NO_ALIAS')
      ) {
        setMessage(
          'Verifica un dominio por DNS y crea un alias (ej. hola@tudominio.com) antes de enviar.',
        );
      } else if (msg.includes('NO_DEFAULT_SENDING_IDENTITY')) {
        setMessage('Hay varios remitentes. Elige uno abajo o márcalo como predeterminado.');
      } else {
        setMessage(msg);
      }
    } finally {
      setSending(false);
    }
  }

  if (!activeId) {
    return (
      <p className="text-muted-foreground">
        Selecciona un proyecto en{' '}
        <Link href="/dashboard/projects" className="text-gold underline">
          Proyectos
        </Link>
        .
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title="Correo de prueba"
        description="Envía un correo real desde un alias de tu dominio verificado — con plantilla o contenido libre"
      />

      {!isPremium && (
        <div className="mb-4 space-y-3">
          <PlanLimitBanner
            label="Correos de prueba"
            used={testUsed}
            max={testLimit}
            blocked={!allowTest}
            showUsage
            description={
              !allowTest ? limitMessage('correos de prueba', testUsed, testLimit) : undefined
            }
          />
          <PlanLimitBanner
            label={`Correos enviados (${windowHours}h)`}
            used={emailUsed}
            max={emailLimit}
            blocked={!allowSend}
            showUsage
            description={
              !allowSend
                ? `Cuota agotada: ${emailUsed}/${emailLimit} correos en las últimas ${windowHours} horas.`
                : undefined
            }
          />
        </div>
      )}

      <div className="grid max-w-5xl gap-5 lg:grid-cols-3">
        <Card className={`lg:col-span-2 ${!canSendNow ? 'opacity-75' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-gold" />
              Enviar prueba
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Desde</Label>
              {aliases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay aliases listos.{' '}
                  <Link href="/dashboard/aliases" className="text-gold underline">
                    Crea uno
                  </Link>{' '}
                  en un dominio verificado.
                </p>
              ) : aliases.length === 1 ? (
                <p className="rounded-2xl border border-border/80 bg-white/80 px-4 py-2.5 text-sm font-medium text-charcoal">
                  {aliases[0].full_email}
                  {aliases[0].is_default ? ' ★' : ''}
                </p>
              ) : (
                <select
                  className="input-crextio w-full"
                  value={aliasId}
                  onChange={(e) => setAliasId(e.target.value)}
                >
                  {aliases.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_email}
                      {a.is_default ? ' ★ predeterminado' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Destinatario</Label>
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="tu@correo.com"
                required
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'template' ? 'default' : 'secondary'}
                onClick={() => setMode('template')}
              >
                Usar plantilla
              </Button>
              <Button
                type="button"
                variant={mode === 'custom' ? 'default' : 'secondary'}
                onClick={() => setMode('custom')}
              >
                Contenido libre
              </Button>
            </div>

            {mode === 'template' ? (
              <>
                <div className="space-y-2">
                  <Label>Plantilla</Label>
                  <select
                    className="input-crextio w-full"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.name} (/{t.slug})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Asunto (opcional, sobrescribe el de la plantilla)</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Variables (JSON)</Label>
                  <textarea
                    className="input-crextio min-h-[100px] w-full font-mono text-sm"
                    value={dataJson}
                    onChange={(e) => setDataJson(e.target.value)}
                  />
                  {templates.find((t) => t.slug === template)?.variables?.length ? (
                    <p className="text-xs text-muted-foreground">
                      Campos de la plantilla:{' '}
                      {templates
                        .find((t) => t.slug === template)!
                        .variables!.map((v) => `{{${v}}}`)
                        .join(', ')}
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>HTML del correo</Label>
                  <textarea
                    className="min-h-[200px] w-full rounded-2xl border border-border/80 bg-white/80 p-4 font-mono text-sm"
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                  />
                </div>
              </>
            )}

            {message && (
              <p
                className={`rounded-2xl px-4 py-2 text-sm ${
                  message.includes('enviado')
                    ? 'bg-gold/15 text-charcoal'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {message}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="gold"
                onClick={sendTest}
                disabled={sending || !to || !aliasId || !canSendNow}
              >
                {sending ? 'Enviando…' : 'Enviar correo de prueba'}
              </Button>
              {!canSendNow && <UpgradeButton label="Más envíos con Premium" />}
              <Button variant="secondary" asChild>
                <Link href="/dashboard/aliases">Gestionar aliases</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-gold" />
              Score bandeja
              {analyze && (
                <span
                  className={cn(
                    'ml-auto rounded-full px-3 py-0.5 text-sm font-bold',
                    analyze.score >= 75 ? 'bg-gold/30 text-charcoal' : 'bg-charcoal/10',
                  )}
                >
                  {analyze.score}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {analyze ? (
              <>
                {analyze.checks.slice(0, 4).map((c) => (
                  <p key={c.id} className={c.ok ? 'text-charcoal' : 'text-muted-foreground'}>
                    {c.ok ? '✓' : '○'} {c.label}
                  </p>
                ))}
                {analyze.score < 75 && (
                  <p className="text-xs text-amber-800 pt-2">
                    Mejora el contenido antes de enviar para reducir spam.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Analizando…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
