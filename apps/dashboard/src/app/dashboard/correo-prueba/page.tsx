'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Send, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliverabilityReport {
  score: number;
  checks: { id: string; ok: boolean; label: string; detail: string }[];
  tips: string[];
}

interface Template {
  id: string;
  slug: string;
  name: string;
}

type SendMode = 'template' | 'custom';

export default function CorreoPruebaPage() {
  const { activeId } = useProjects();
  const [templates, setTemplates] = useState<Template[]>([]);
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

  useEffect(() => {
    if (!activeId) return;
    api<{ templates: Template[] }>(`/api/templates/${activeId}`).then((r) => {
      setTemplates(r.templates);
      if (r.templates[0]) setTemplate(r.templates[0].slug);
    });
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const t = setTimeout(() => {
      const body: Record<string, unknown> =
        mode === 'template'
          ? { template, data: (() => {
              try {
                return JSON.parse(dataJson);
              } catch {
                return {};
              }
            })(), ...(subject.trim() ? { subject } : {}) }
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
    if (!activeId || !to) return;
    setSending(true);
    setMessage('');
    try {
      const body: Record<string, unknown> = { to };
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al enviar';
      if (msg.includes('SMTP_FROM_DOMAIN_MISMATCH')) {
        setMessage(
          'El correo remitente debe ser del mismo dominio que el usuario SMTP (ej. ambos @gmail.com).',
        );
      } else if (msg.includes('SMTP_NOT_VERIFIED') || msg.includes('SMTP_NOT_CONFIGURED')) {
        setMessage(
          'Configura SMTP y pulsa «Probar conexión» antes de enviar. ' +
            'Ve a Configuración SMTP.',
        );
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
        description="Envía un correo real desde tu SMTP configurado — con plantilla o contenido libre"
      />

      <div className="grid gap-5 lg:grid-cols-3 max-w-5xl">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-gold" />
            Enviar prueba
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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
                message.includes('enviado') ? 'bg-gold/15 text-charcoal' : 'bg-red-50 text-red-800'
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="gold" onClick={sendTest} disabled={sending || !to}>
              {sending ? 'Enviando…' : 'Enviar correo de prueba'}
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/dashboard/smtp">Configuración SMTP</Link>
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
