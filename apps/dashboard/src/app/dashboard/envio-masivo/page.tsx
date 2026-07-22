'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import { listTemplates } from '@/lib/db/templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseRecipientsFromJson } from '@/lib/recipients';
import {
  AlertCircle,
  CheckCircle2,
  FileJson,
  Lock,
  Palette,
  Send,
  Upload,
  Users,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PreloadBlock } from '@/lib/preload';
import { PremiumGate } from '@/components/billing/PremiumGate';

interface Template {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  variables: string[];
}

interface Group {
  id: string;
  name: string;
  member_count?: number;
}

interface BulkResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{ email: string; status: string; error?: string }>;
  scheduled?: boolean;
  campaignId?: string;
}

type SourceMode = 'json' | 'group';

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EnvioMasivoPage() {
  const { activeId } = useProjects();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [source, setSource] = useState<SourceMode>('json');
  const [groupId, setGroupId] = useState('');
  const [templateSlug, setTemplateSlug] = useState('campana');
  const [jsonText, setJsonText] = useState('');
  const [emailField, setEmailField] = useState('email');
  const [titulo, setTitulo] = useState('Tenemos novedades para ti');
  const [mensaje, setMensaje] = useState(
    'Queremos contarte las últimas actualizaciones. Gracias por ser parte de nuestra comunidad.',
  );
  const [enlace, setEnlace] = useState('https://tudominio.com');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() =>
    toLocalDatetimeValue(new Date(Date.now() + 3600_000)),
  );
  const [parseError, setParseError] = useState('');
  const [preview, setPreview] = useState({ html: '', subject: '' });
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<BulkResult | null>(null);

  useEffect(() => {
    if (!activeId) return;
    listTemplates(activeId).then((templates) => {
      setTemplates(templates as Template[]);
      const campana = templates.find((t) => t.slug === 'campana');
      if (campana) setTemplateSlug(campana.slug);
      else if (templates[0]) setTemplateSlug(templates[0].slug);
    });
    api<{ groups: Group[] }>(`/api/contacts/${activeId}/groups`)
      .then((r) => {
        setGroups(r.groups);
        if (r.groups[0]) setGroupId(r.groups[0].id);
      })
      .catch(() => setGroups([]));
  }, [activeId]);

  const parsed = useMemo(() => {
    if (source !== 'json' || !jsonText.trim()) return null;
    try {
      const users = JSON.parse(jsonText) as
        | Record<string, Record<string, unknown>>
        | Array<Record<string, unknown>>;
      const out = parseRecipientsFromJson(users, { emailField });
      setParseError('');
      return out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'JSON inválido';
      setParseError(msg === 'EMAIL_FIELD_NOT_FOUND' ? 'No se encontró campo de correo' : msg);
      return null;
    }
  }, [jsonText, emailField, source]);

  const selectedTemplate = templates.find((t) => t.slug === templateSlug);
  const selectedGroup = groups.find((g) => g.id === groupId);

  function enrichData(base: Record<string, unknown>): Record<string, unknown> {
    return {
      ...base,
      titulo: titulo.trim() || base.titulo,
      mensaje: mensaje.trim() || base.mensaje,
      enlace: enlace.trim() || base.enlace,
    };
  }

  useEffect(() => {
    if (!activeId || !selectedTemplate) {
      setPreview({ html: '', subject: '' });
      return;
    }
    const sample =
      source === 'json' && parsed?.recipients[0]
        ? enrichData(parsed.recipients[0].data)
        : enrichData({ nombre: 'Ana', primerNombre: 'Ana' });
    const t = setTimeout(async () => {
      try {
        const res = await api<{ preview: { html: string; subject: string } }>(
          `/api/templates/${activeId}/preview`,
          {
            method: 'POST',
            body: JSON.stringify({
              htmlContent: selectedTemplate.html_content,
              subject: selectedTemplate.subject,
              data: sample,
            }),
          },
        );
        setPreview(res.preview);
      } catch {
        setPreview({ html: '', subject: '' });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [activeId, parsed, selectedTemplate, titulo, mensaje, enlace, source]);

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setJsonText(reader.result);
    };
    reader.readAsText(file);
  }

  async function sendBulk() {
    if (!activeId) return;
    setSending(true);
    setResult(null);

    const scheduleIso = scheduleEnabled ? new Date(scheduledAt).toISOString() : undefined;
    const sharedVars = enrichData({});

    try {
      if (source === 'group') {
        if (!groupId) return;
        setProgress(
          scheduleIso
            ? `Programando campaña al grupo…`
            : `Enviando a grupo (${selectedGroup?.member_count ?? '?'} contactos)…`,
        );
        const res = await api<BulkResult & { success: boolean }>(`/api/emails/${activeId}/group`, {
          method: 'POST',
          body: JSON.stringify({
            groupId,
            template: templateSlug,
            data: sharedVars,
            scheduledAt: scheduleIso,
            campaignName: selectedGroup?.name ? `Grupo: ${selectedGroup.name}` : undefined,
          }),
        });
        setResult(res);
        setProgress(
          res.scheduled
            ? `Programado: ${res.total} jobs en cola (campaña ${res.campaignId?.slice(0, 8)}…)`
            : `Completado: ${res.sent} enviados, ${res.failed} fallidos`,
        );
      } else {
        if (!parsed || parsed.recipients.length === 0) return;
        const recipients = parsed.recipients.map((r) => ({
          email: r.email,
          data: enrichData(r.data),
        }));
        setProgress(
          scheduleIso
            ? `Encolando ${recipients.length} envíos programados…`
            : `Enviando a ${recipients.length} destinatarios…`,
        );
        const res = await api<BulkResult & { success: boolean }>(`/api/emails/${activeId}/bulk`, {
          method: 'POST',
          body: JSON.stringify({
            template: templateSlug,
            recipients,
            delayMs: 200,
            scheduledAt: scheduleIso,
            campaignName: 'Envío masivo JSON',
          }),
        });
        setResult(res);
        setProgress(
          res.scheduled
            ? `Programado: ${res.total} jobs durables creados`
            : `Completado: ${res.sent} enviados, ${res.failed} fallidos`,
        );
      }
    } catch (e) {
      setProgress(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  const canSend = source === 'group' ? Boolean(groupId) : Boolean(parsed?.recipients.length);

  return (
    <PremiumGate feature="El envío masivo">
      <div>
        <PageHeader
          title="Envío masivo"
          description="Plantilla + JSON o grupo de contactos. Opcional: programar como jobs durables."
        >
          <Link href="/dashboard/creador">
            <Button variant="secondary">
              <Palette className="mr-2 h-4 w-4" />
              Crear plantilla
            </Button>
          </Link>
        </PageHeader>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm text-charcoal">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <p className="font-semibold">Privacidad garantizada</p>
            <p className="mt-1 text-muted-foreground">
              Se envía un correo individual por destinatario. Nadie ve la lista de los demás.
            </p>
          </div>
        </div>

        <div className="mb-5 flex gap-2">
          <Button
            type="button"
            variant={source === 'json' ? 'default' : 'secondary'}
            onClick={() => setSource('json')}
          >
            <FileJson className="mr-2 h-4 w-4" />
            Desde JSON
          </Button>
          <Button
            type="button"
            variant={source === 'group' ? 'default' : 'secondary'}
            onClick={() => setSource('group')}
          >
            <UsersRound className="mr-2 h-4 w-4" />
            Desde grupo
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            {source === 'json' ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileJson className="h-5 w-5" />
                    Usuarios (JSON)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f);
                        }}
                      />
                      <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white">
                        <Upload className="h-4 w-4" />
                        Subir archivo
                      </span>
                    </label>
                  </div>
                  <textarea
                    className="min-h-[200px] w-full rounded-2xl border border-border/80 bg-white/80 p-4 font-mono text-xs shadow-sm focus:ring-2 focus:ring-gold/30 focus:outline-none"
                    placeholder='{"id1":{"email":"a@b.com","name":"Ana"},...}'
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                  />
                  <div className="space-y-2">
                    <Label>Campo de correo</Label>
                    <Input value={emailField} onChange={(e) => setEmailField(e.target.value)} />
                  </div>
                  {parseError && (
                    <p className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      {parseError}
                    </p>
                  )}
                  {parsed && (
                    <p className="flex items-center gap-2 text-sm text-emerald-700">
                      <Users className="h-4 w-4" />
                      {parsed.recipients.length} destinatarios válidos
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UsersRound className="h-5 w-5" />
                    Grupo de contactos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <select
                      className="w-full rounded-2xl border border-border/80 bg-white/80 px-4 py-2.5 text-sm"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                    >
                      {!groups.length && <option value="">Sin grupos — créalos primero</option>}
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.member_count ?? 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Link href="/dashboard/grupos" className="text-sm text-gold underline">
                    Gestionar grupos
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contenido del mensaje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Plantilla</Label>
                  <select
                    className="w-full rounded-2xl border border-border/80 bg-white/80 px-4 py-2.5 text-sm"
                    value={templateSlug}
                    onChange={(e) => setTemplateSlug(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Título ({'{{titulo}}'})</Label>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mensaje ({'{{mensaje}}'})</Label>
                  <textarea
                    className="min-h-[100px] w-full rounded-2xl border border-border/80 bg-white/80 p-4 text-sm"
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Enlace ({'{{enlace}}'})</Label>
                  <Input value={enlace} onChange={(e) => setEnlace(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                  />
                  Programar envío (cola durable)
                </label>
                {scheduleEnabled && (
                  <div className="space-y-2">
                    <Label>Fecha y hora</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button variant="gold" disabled={!canSend || sending} onClick={sendBulk}>
                <Send className="mr-2 h-4 w-4" />
                {sending
                  ? 'Procesando…'
                  : scheduleEnabled
                    ? 'Programar campaña'
                    : source === 'group'
                      ? 'Enviar al grupo'
                      : `Enviar a ${parsed?.recipients.length ?? 0} usuarios`}
              </Button>
            </div>
            {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
            {result && !result.scheduled && (
              <Card className={cn(result.failed > 0 ? 'border-amber-300' : 'border-emerald-300')}>
                <CardContent className="pt-6">
                  <p className="flex items-center gap-2 font-medium">
                    {result.failed === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    )}
                    {result.sent} de {result.total} enviados correctamente
                  </p>
                </CardContent>
              </Card>
            )}
            {result?.scheduled && (
              <Card className="border-gold/40">
                <CardContent className="pt-6 text-sm">
                  <p className="font-medium">Campaña encolada en Programados</p>
                  <Link
                    href="/dashboard/programados"
                    className="mt-2 inline-block text-gold underline"
                  >
                    Ver progreso y cancelar
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="h-fit lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle className="text-lg">Vista previa</CardTitle>
            </CardHeader>
            <CardContent>
              {preview.html ? (
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
                  <p className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">
                    Asunto: {preview.subject}
                  </p>
                  <iframe
                    title="vista-previa-masivo"
                    srcDoc={preview.html}
                    className="h-[480px] w-full bg-white"
                    sandbox=""
                  />
                </div>
              ) : (
                <PreloadBlock minHeight="min-h-[8rem]" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PremiumGate>
  );
}
