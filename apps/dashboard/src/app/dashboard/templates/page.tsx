'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { TemplateUsageDocs } from '@/components/template-builder/template-usage-docs';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Palette, Pencil } from 'lucide-react';

interface Template {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  variables: string[];
  is_system: boolean;
}

export default function TemplatesPage() {
  const { activeId, active } = useProjects();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [preview, setPreview] = useState({ html: '', subject: '' });
  const [previewData, setPreviewData] = useState('{"nombre":"Juan"}');

  useEffect(() => {
    if (!activeId) return;
    api<{ templates: Template[] }>(`/api/templates/${activeId}`).then((r) => {
      setTemplates(r.templates);
      if (r.templates[0]) setSelected(r.templates[0]);
    });
  }, [activeId]);

  async function runPreview() {
    if (!activeId || !selected) return;
    let data = {};
    try {
      data = JSON.parse(previewData);
    } catch {
      return;
    }
    const res = await api<{ preview: { html: string; subject: string } }>(
      `/api/templates/${activeId}/preview`,
      {
        method: 'POST',
        body: JSON.stringify({
          htmlContent: selected.html_content,
          subject: selected.subject,
          data,
        }),
      },
    );
    setPreview(res.preview);
  }

  async function saveTemplate() {
    if (!activeId || !selected) return;
    await api(`/api/templates/${activeId}/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        subject: selected.subject,
        htmlContent: selected.html_content,
      }),
    });
  }

  return (
    <div>
      <PageHeader
        title="Plantillas"
        description="Lista, vista previa y documentación de uso desde tu app"
      >
        <Link href="/dashboard/creador">
          <Button variant="gold">
            <Palette className="mr-2 h-4 w-4" />
            Abrir creador visual
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Lista</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left text-sm transition-all',
                  selected?.id === t.id
                    ? 'border-gold/50 bg-gold/15 shadow-sm'
                    : 'border-transparent bg-charcoal/5 hover:bg-charcoal/8',
                )}
              >
                <span className="font-semibold text-charcoal">{t.name}</span>
                <span className="ml-2 text-muted-foreground">/{t.slug}</span>
                {t.is_system && (
                  <span className="ml-2 rounded-full bg-charcoal/10 px-2 py-0.5 text-xs">sistema</span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {selected && (
          <div className="lg:col-span-3 space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{selected.name}</CardTitle>
                <Link href={`/dashboard/creador?id=${selected.id}`}>
                  <Button variant="secondary" size="sm">
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar en creador
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input
                    value={selected.subject}
                    onChange={(e) => setSelected({ ...selected, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>HTML</Label>
                  <textarea
                    className="min-h-[180px] w-full rounded-2xl border border-border/80 bg-white/80 p-4 font-mono text-sm shadow-sm focus:ring-2 focus:ring-gold/30 focus:outline-none"
                    value={selected.html_content}
                    onChange={(e) => setSelected({ ...selected, html_content: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vista previa (JSON de variables)</Label>
                  <Input value={previewData} onChange={(e) => setPreviewData(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="gold" onClick={runPreview}>
                    Vista previa
                  </Button>
                  <Button variant="default" onClick={saveTemplate}>
                    Guardar
                  </Button>
                </div>
                {preview.html && (
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-white p-4">
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Asunto: {preview.subject}
                    </p>
                    <iframe
                      title="vista-previa"
                      srcDoc={preview.html}
                      className="h-56 w-full rounded-xl bg-white"
                      sandbox=""
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <TemplateUsageDocs
              slug={selected.slug}
              variables={selected.variables}
              projectSlug={active?.slug}
            />
          </div>
        )}
      </div>
    </div>
  );
}
