'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { TemplateBuilder } from '@/components/template-builder/template-builder';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import type { EmailBlock } from '@/lib/email-builder';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  builder_data: EmailBlock[] | null;
  variables: string[];
}

function CreadorInner() {
  const { activeId, active } = useProjects();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const [loading, setLoading] = useState(!!editId);
  const [initial, setInitial] = useState<TemplateRow | null>(null);
  const [isNew, setIsNew] = useState(!editId);

  useEffect(() => {
    if (!activeId || !editId) {
      setLoading(false);
      setIsNew(true);
      setInitial(null);
      return;
    }
    api<{ templates: TemplateRow[] }>(`/api/templates/${activeId}`)
      .then((r) => {
        const t = r.templates.find((x) => x.id === editId);
        setInitial(t ?? null);
        setIsNew(!t);
      })
      .finally(() => setLoading(false));
  }, [activeId, editId]);

  if (!activeId) {
    return (
      <p className="text-muted-foreground">
        Crea o selecciona un proyecto en{' '}
        <Link href="/dashboard/projects" className="text-gold underline">
          Proyectos
        </Link>
        .
      </p>
    );
  }

  if (loading) return <p className="text-muted-foreground">Cargando plantilla…</p>;

  const key = isNew ? 'new' : (initial?.id ?? 'new');

  return (
    <TemplateBuilder
      key={key}
      projectSlug={active?.slug}
      initial={
        initial
          ? {
              id: initial.id,
              slug: initial.slug,
              name: initial.name,
              subject: initial.subject,
              blocks: initial.builder_data,
              html_content: initial.html_content,
            }
          : {
              slug: 'mi-plantilla',
              name: 'Nueva plantilla',
              subject: 'Hola, {{nombre}}',
            }
      }
      onSave={async (payload) => {
        if (initial?.id) {
          await api(`/api/templates/${activeId}/${initial.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: payload.name,
              subject: payload.subject,
              htmlContent: payload.htmlContent,
              builderData: payload.builderData,
              variables: payload.variables,
            }),
          });
        } else {
          const res = await api<{ template: TemplateRow }>(`/api/templates/${activeId}`, {
            method: 'POST',
            body: JSON.stringify({
              slug: payload.slug,
              name: payload.name,
              subject: payload.subject,
              htmlContent: payload.htmlContent,
              builderData: payload.builderData,
              variables: payload.variables,
            }),
          });
          setInitial(res.template);
          setIsNew(false);
          window.history.replaceState(null, '', `/dashboard/creador?id=${res.template.id}`);
        }
      }}
      onPreview={async (html, subject) => {
        const res = await api<{ preview: { html: string; subject: string } }>(
          `/api/templates/${activeId}/preview`,
          {
            method: 'POST',
            body: JSON.stringify({
              htmlContent: html,
              subject,
              data: Object.fromEntries(
                extractVars(html + subject).map((v) => [v, v === 'nombre' ? 'María' : 'ejemplo']),
              ),
            }),
          },
        );
        return res.preview;
      }}
    />
  );
}

function extractVars(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];
}

export default function CreadorPage() {
  return (
    <div>
      <PageHeader
        title="Creador de plantillas"
        description="Arrastra bloques, personaliza estilos o edita HTML directo. Se guarda en tu proyecto y base de datos."

      >
        <Link href="/dashboard/creador">
          <Button variant="secondary">
            <Plus className="mr-2 h-4 w-4" />
            Nueva plantilla
          </Button>
        </Link>
      </PageHeader>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <CreadorInner />
      </Suspense>
    </div>
  );
}
