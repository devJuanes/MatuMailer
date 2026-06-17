'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { PremiumGate } from '@/components/billing/PremiumGate';

interface Template {
  id: string;
  slug: string;
  name: string;
}

interface ScheduledRow {
  id: string;
  to_email: string;
  subject: string;
  scheduled_at: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

type SendMode = 'template' | 'custom';

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Enviando…',
  sent: 'Enviado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
};

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ProgramadosPage() {
  const { activeId } = useProjects();
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mode, setMode] = useState<SendMode>('template');
  const [to, setTo] = useState('');
  const [template, setTemplate] = useState('welcome');
  const [dataJson, setDataJson] = useState('{"nombre":"Cliente"}');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('<h1>Recordatorio</h1><p>Tu mensaje programado.</p>');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 3600_000);
    return toLocalDatetimeValue(d);
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) return;
    const res = await api<{ scheduled: ScheduledRow[] }>(`/api/emails/${activeId}/scheduled`);
    setScheduled(res.scheduled);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    load();
    api<{ templates: Template[] }>(`/api/templates/${activeId}`).then((r) => {
      setTemplates(r.templates);
      if (r.templates[0]) setTemplate(r.templates[0].slug);
    });
  }, [activeId, load]);

  async function scheduleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !to) return;
    setLoading(true);
    setMessage('');
    try {
      const at = new Date(scheduledAt).toISOString();
      const body: Record<string, unknown> = { to, scheduledAt: at };
      if (mode === 'template') {
        let data = {};
        try {
          data = JSON.parse(dataJson);
        } catch {
          setMessage('JSON de variables inválido');
          setLoading(false);
          return;
        }
        body.template = template;
        body.data = data;
        if (subject.trim()) body.subject = subject;
      } else {
        body.html = html;
        body.subject = subject || 'Correo programado';
      }
      await api(`/api/emails/${activeId}/scheduled`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setMessage('Correo programado correctamente');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al programar');
    } finally {
      setLoading(false);
    }
  }

  async function cancel(id: string) {
    if (!activeId) return;
    await api(`/api/emails/${activeId}/scheduled/${id}`, { method: 'DELETE' });
    await load();
  }

  if (!activeId) {
    return (
      <p className="text-muted-foreground">
        Selecciona un proyecto en <Link href="/dashboard/projects">Proyectos</Link>.
      </p>
    );
  }

  return (
    <PremiumGate feature="Los envíos programados">
      <div className="space-y-6">
        <PageHeader
          title="Envíos programados"
          description="Cola con fecha y hora — el servidor procesa los pendientes automáticamente"
        />

        <div className="grid gap-5 lg:grid-cols-2 max-w-6xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-gold" />
                Programar nuevo envío
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={scheduleSend} className="space-y-4">
                <div className="space-y-2">
                  <Label>Destinatario</Label>
                  <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Fecha y hora (tu zona local)</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Mínimo 1 minuto en el futuro</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={mode === 'template' ? 'default' : 'secondary'}
                    onClick={() => setMode('template')}
                  >
                    Plantilla
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'custom' ? 'default' : 'secondary'}
                    onClick={() => setMode('custom')}
                  >
                    HTML libre
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
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Variables JSON</Label>
                      <textarea
                        className="input-crextio min-h-[80px] w-full font-mono text-sm"
                        value={dataJson}
                        onChange={(e) => setDataJson(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Asunto</Label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>HTML</Label>
                      <textarea
                        className="min-h-[120px] w-full rounded-2xl border p-3 font-mono text-sm"
                        value={html}
                        onChange={(e) => setHtml(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {message && (
                  <p
                    className={cn(
                      'rounded-2xl px-4 py-2 text-sm',
                      message.includes('correctamente')
                        ? 'bg-gold/15 text-charcoal'
                        : 'bg-red-50 text-red-800',
                    )}
                  >
                    {message}
                  </p>
                )}
                <Button type="submit" variant="gold" disabled={loading}>
                  {loading ? 'Guardando…' : 'Añadir a la cola'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cola del proyecto</CardTitle>
              <Button type="button" variant="secondary" size="sm" onClick={() => load()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {scheduled.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay envíos programados.</p>
              ) : (
                scheduled.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-border/50 bg-white/60 p-4 text-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold text-charcoal">{row.subject}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                          row.status === 'pending' && 'bg-gold/25 text-charcoal',
                          row.status === 'sent' && 'bg-green-100 text-green-800',
                          row.status === 'failed' && 'bg-red-100 text-red-800',
                          row.status === 'cancelled' && 'bg-charcoal/10',
                        )}
                      >
                        {statusLabel[row.status] ?? row.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{row.to_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(row.scheduled_at).toLocaleString('es')}
                    </p>
                    {row.error_message && (
                      <p className="mt-2 text-xs text-red-700">{row.error_message}</p>
                    )}
                    {row.status === 'pending' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => cancel(row.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PremiumGate>
  );
}
