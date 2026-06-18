'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
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

interface BulkResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{ email: string; status: string; error?: string }>;
}

export default function EnvioMasivoPage() {
  const { activeId } = useProjects();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSlug, setTemplateSlug] = useState('campana');
  const [jsonText, setJsonText] = useState('');
  const [emailField, setEmailField] = useState('email');
  const [titulo, setTitulo] = useState('Tenemos novedades para ti');
  const [mensaje, setMensaje] = useState(
    'Queremos contarte las últimas actualizaciones. Gracias por ser parte de nuestra comunidad.',
  );
  const [enlace, setEnlace] = useState('https://tudominio.com');
  const [parseError, setParseError] = useState('');
  const [preview, setPreview] = useState({ html: '', subject: '' });
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<BulkResult | null>(null);

  useEffect(() => {
    if (!activeId) return;
    api<{ templates: Template[] }>(`/api/templates/${activeId}`).then((r) => {
      setTemplates(r.templates as Template[]);
      const campana = r.templates.find((t) => t.slug === 'campana');
      if (campana) setTemplateSlug(campana.slug);
      else if (r.templates[0]) setTemplateSlug(r.templates[0].slug);
    });
  }, [activeId]);

  const parsed = useMemo(() => {
    if (!jsonText.trim()) return null;
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
  }, [jsonText, emailField]);

  const selectedTemplate = templates.find((t) => t.slug === templateSlug);

  function enrichData(base: Record<string, unknown>): Record<string, unknown> {
    return {
      ...base,
      titulo: titulo.trim() || base.titulo,
      mensaje: mensaje.trim() || base.mensaje,
      enlace: enlace.trim() || base.enlace,
    };
  }

  useEffect(() => {
    if (!activeId || !parsed?.recipients[0] || !selectedTemplate) {
      setPreview({ html: '', subject: '' });
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api<{ preview: { html: string; subject: string } }>(
          `/api/templates/${activeId}/preview`,
          {
            method: 'POST',
            body: JSON.stringify({
              htmlContent: selectedTemplate.html_content,
              subject: selectedTemplate.subject,
              data: enrichData(parsed.recipients[0].data),
            }),
          },
        );
        setPreview(res.preview);
      } catch {
        setPreview({ html: '', subject: '' });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [activeId, parsed, selectedTemplate, titulo, mensaje, enlace]);

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setJsonText(reader.result);
    };
    reader.readAsText(file);
  }

  async function sendBulk() {
    if (!activeId || !parsed || parsed.recipients.length === 0) return;
    setSending(true);
    setResult(null);
    setProgress(`Enviando a ${parsed.recipients.length} destinatarios (uno por uno, en privado)…`);

    const recipients = parsed.recipients.map((r) => ({
      email: r.email,
      data: enrichData(r.data),
    }));

    try {
      const res = await api<BulkResult & { success: boolean }>(`/api/emails/${activeId}/bulk`, {
        method: 'POST',
        body: JSON.stringify({
          template: templateSlug,
          recipients,
          delayMs: 200,
        }),
      });
      setResult(res);
      setProgress(`Completado: ${res.sent} enviados, ${res.failed} fallidos`);
    } catch (e) {
      setProgress(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  return (
    <PremiumGate feature="El envío masivo">
      <div>
        <PageHeader
          title="Envío masivo"
          description="Plantillas personalizadas a muchos usuarios. Cada persona recibe solo su correo — nadie ve los demás."
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
              Se envía un correo individual por destinatario. Pepito solo ve su email en «Para:»,
              nunca la lista de los demás. Las contraseñas del JSON se excluyen automáticamente.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
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
                  <span className="self-center text-xs text-muted-foreground">
                    Objeto con IDs o array · detecta <code>email</code> automáticamente
                  </span>
                </div>
                <textarea
                  className="min-h-[200px] w-full rounded-2xl border border-border/80 bg-white/80 p-4 font-mono text-xs shadow-sm focus:ring-2 focus:ring-gold/30 focus:outline-none"
                  placeholder='{"id1":{"email":"a@b.com","name":"Ana"},...} o [{...}]'
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Campo de correo</Label>
                    <Input value={emailField} onChange={(e) => setEmailField(e.target.value)} />
                  </div>
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
                    {parsed.skipped > 0 && ` · ${parsed.skipped} omitidos (sin email o duplicados)`}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contenido del mensaje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <Label>Enlace del botón ({'{{enlace}}'})</Label>
                  <Input value={enlace} onChange={(e) => setEnlace(e.target.value)} />
                </div>
                {selectedTemplate && selectedTemplate.variables.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Variables de la plantilla:{' '}
                    {selectedTemplate.variables.map((v) => `{{${v}}}`).join(', ')}. Los campos del
                    JSON (name, phone, code…) se mapean automáticamente a nombre, telefono, codigo,
                    etc.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="gold"
                disabled={!parsed?.recipients.length || sending}
                onClick={sendBulk}
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Enviando…' : `Enviar a ${parsed?.recipients.length ?? 0} usuarios`}
              </Button>
            </div>
            {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
            {result && (
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
                  {result.failed > 0 && (
                    <ul className="mt-3 max-h-32 overflow-y-auto text-xs text-red-600">
                      {result.results
                        .filter((r) => r.status === 'failed')
                        .slice(0, 10)
                        .map((r) => (
                          <li key={r.email}>
                            {r.email}: {r.error}
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="h-fit lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle className="text-lg">Vista previa</CardTitle>
            </CardHeader>
            <CardContent>
              {parsed?.recipients[0] ? (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Ejemplo para: <strong>{parsed.recipients[0].email}</strong>
                    {typeof parsed.recipients[0].data.nombre === 'string' && (
                      <> · {String(parsed.recipients[0].data.nombre)}</>
                    )}
                  </p>
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pega o sube tu JSON de usuarios para ver la vista previa del primer destinatario.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PremiumGate>
  );
}
