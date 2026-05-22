'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Type,
  AlignLeft,
  MousePointerClick,
  Minus,
  ArrowDownFromLine,
  Image as ImageIcon,
  Code2,
  Layout,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  BLOCK_LABELS,
  blocksToHtml,
  extractVariables,
  DEFAULT_BLOCKS,
  newBlock,
  type BlockType,
  type EmailBlock,
} from '@/lib/email-builder';
import { TemplateUsageDocs } from './template-usage-docs';

const PALETTE: { type: BlockType; icon: typeof Type }[] = [
  { type: 'heading', icon: Type },
  { type: 'text', icon: AlignLeft },
  { type: 'button', icon: MousePointerClick },
  { type: 'divider', icon: Minus },
  { type: 'spacer', icon: ArrowDownFromLine },
  { type: 'image', icon: ImageIcon },
];

function SortableBlock({
  block,
  selected,
  onSelect,
  onRemove,
}: {
  block: EmailBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 rounded-2xl border p-3 transition-all',
        selected ? 'border-gold/60 bg-gold/10 shadow-sm' : 'border-border/60 bg-white/80',
        isDragging && 'opacity-60 shadow-lg',
      )}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      tabIndex={0}
    >
      <button
        type="button"
        className="mt-1 cursor-grab touch-none rounded-lg p-1 text-muted-foreground hover:bg-charcoal/5 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Arrastrar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gold">
          {BLOCK_LABELS[block.type]}
        </span>
        <p className="mt-1 truncate text-sm text-charcoal">
          {block.type === 'divider'
            ? '— línea horizontal —'
            : block.type === 'spacer'
              ? `${block.height ?? 24}px de espacio`
              : (block.content ?? '').slice(0, 80)}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
        aria-label="Eliminar bloque"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export interface TemplateBuilderMeta {
  id?: string;
  slug: string;
  name: string;
  subject: string;
}

interface Props {
  projectSlug?: string;
  initial?: TemplateBuilderMeta & {
    blocks?: EmailBlock[] | null;
    html_content?: string;
  };
  onSave: (payload: {
    slug: string;
    name: string;
    subject: string;
    htmlContent: string;
    builderData: EmailBlock[] | null;
    variables: string[];
  }) => Promise<void>;
  onPreview?: (html: string, subject: string) => Promise<{ html: string; subject: string }>;
}

export function TemplateBuilder({ projectSlug, initial, onSave, onPreview }: Props) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [meta, setMeta] = useState<TemplateBuilderMeta>({
    id: initial?.id,
    slug: initial?.slug ?? 'mi-plantilla',
    name: initial?.name ?? 'Nueva plantilla',
    subject: initial?.subject ?? 'Hola, {{nombre}}',
  });
  const [blocks, setBlocks] = useState<EmailBlock[]>(
    initial?.blocks?.length ? initial.blocks : DEFAULT_BLOCKS,
  );
  const [htmlCode, setHtmlCode] = useState(initial?.html_content ?? blocksToHtml(DEFAULT_BLOCKS));
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null);
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const effectiveHtml = useMemo(
    () => (mode === 'visual' ? blocksToHtml(blocks) : htmlCode),
    [mode, blocks, htmlCode],
  );

  const variables = useMemo(() => {
    const html = mode === 'visual' ? blocksToHtml(blocks) : htmlCode;
    return extractVariables(html + meta.subject);
  }, [mode, blocks, meta.subject, htmlCode]);

  const syncHtmlFromBlocks = useCallback(() => {
    setHtmlCode(blocksToHtml(blocks));
  }, [blocks]);

  function addBlock(type: BlockType) {
    const b = newBlock(type);
    setBlocks((prev) => [...prev, b]);
    setSelectedId(b.id);
  }

  function updateBlock(id: string, patch: Partial<EmailBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const htmlContent = mode === 'visual' ? blocksToHtml(blocks) : htmlCode;
      await onSave({
        slug: meta.slug,
        name: meta.name,
        subject: meta.subject,
        htmlContent,
        builderData: mode === 'visual' ? blocks : null,
        variables,
      });
      setMessage('Plantilla guardada en tu proyecto');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    const html = mode === 'visual' ? blocksToHtml(blocks) : htmlCode;
    if (onPreview) {
      const res = await onPreview(html, meta.subject);
      setPreview(res);
    } else {
      setPreview({ html, subject: meta.subject });
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Slug (URL API)</Label>
          <Input
            value={meta.slug}
            onChange={(e) =>
              setMeta({ ...meta, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
            }
            disabled={!!initial?.id}
          />
        </div>
        <div className="space-y-2">
          <Label>Asunto</Label>
          <Input
            value={meta.subject}
            onChange={(e) => setMeta({ ...meta, subject: e.target.value })}
            placeholder="Hola, {{nombre}}"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={mode === 'visual' ? 'default' : 'secondary'}
          onClick={() => {
            if (mode === 'html') syncHtmlFromBlocks();
            setMode('visual');
          }}
        >
          <Layout className="mr-2 h-4 w-4" />
          Visual
        </Button>
        <Button
          type="button"
          variant={mode === 'html' ? 'default' : 'secondary'}
          onClick={() => {
            if (mode === 'visual') setHtmlCode(blocksToHtml(blocks));
            setMode('html');
          }}
        >
          <Code2 className="mr-2 h-4 w-4" />
          HTML
        </Button>
        <Button type="button" variant="gold" onClick={handlePreview}>
          <Eye className="mr-2 h-4 w-4" />
          Vista previa
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar plantilla'}
        </Button>
        {message && <span className="text-sm text-charcoal">{message}</span>}
      </div>

      {mode === 'visual' ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-2 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bloques — clic para agregar
            </p>
            {PALETTE.map(({ type, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-gold/40 bg-white/60 px-3 py-2.5 text-left text-sm transition-colors hover:border-gold hover:bg-gold/10"
              >
                <Icon className="h-4 w-4 text-gold" />
                {BLOCK_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="lg:col-span-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lienzo — arrastra para reordenar
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 min-h-[200px] rounded-2xl border border-border/50 bg-cream/30 p-3">
                  {blocks.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Agrega bloques desde la izquierda
                    </p>
                  )}
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      selected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onRemove={() => {
                        setBlocks((prev) => prev.filter((b) => b.id !== block.id));
                        if (selectedId === block.id) setSelectedId(null);
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="lg:col-span-5 space-y-4">
            {selected ? (
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 space-y-3">
                <p className="font-semibold text-charcoal">Propiedades — {BLOCK_LABELS[selected.type]}</p>
                {(selected.type === 'heading' ||
                  selected.type === 'text' ||
                  selected.type === 'button' ||
                  selected.type === 'image') && (
                  <div className="space-y-2">
                    <Label>{selected.type === 'image' ? 'URL imagen' : 'Contenido'}</Label>
                    <textarea
                      className="input-crextio min-h-[80px] w-full font-mono text-sm"
                      value={selected.content ?? ''}
                      onChange={(e) => updateBlock(selected.id, { content: e.target.value })}
                    />
                  </div>
                )}
                {selected.type === 'button' && (
                  <div className="space-y-2">
                    <Label>Enlace (href)</Label>
                    <Input
                      value={selected.href ?? ''}
                      onChange={(e) => updateBlock(selected.id, { href: e.target.value })}
                    />
                  </div>
                )}
                {selected.type === 'spacer' && (
                  <div className="space-y-2">
                    <Label>Altura (px)</Label>
                    <Input
                      type="number"
                      value={selected.height ?? 24}
                      onChange={(e) => updateBlock(selected.id, { height: Number(e.target.value) })}
                    />
                  </div>
                )}
                {selected.type !== 'divider' && selected.type !== 'spacer' && (
                  <>
                    <div className="space-y-2">
                      <Label>Alineación</Label>
                      <select
                        className="input-crextio w-full"
                        value={selected.align ?? 'left'}
                        onChange={(e) =>
                          updateBlock(selected.id, {
                            align: e.target.value as EmailBlock['align'],
                          })
                        }
                      >
                        <option value="left">Izquierda</option>
                        <option value="center">Centro</option>
                        <option value="right">Derecha</option>
                      </select>
                    </div>
                    {(selected.type === 'heading' || selected.type === 'text') && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Tamaño</Label>
                          <Input
                            type="number"
                            value={selected.fontSize ?? 16}
                            onChange={(e) =>
                              updateBlock(selected.id, { fontSize: Number(e.target.value) })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <Input
                            value={selected.color ?? '#44403c'}
                            onChange={(e) => updateBlock(selected.id, { color: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    {selected.type === 'button' && (
                      <div className="space-y-2">
                        <Label>Color botón</Label>
                        <Input
                          value={selected.buttonColor ?? '#c9a227'}
                          onChange={(e) => updateBlock(selected.id, { buttonColor: e.target.value })}
                        />
                      </div>
                    )}
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  Variables: usa <code>{'{{nombre}}'}</code> en texto o asunto
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona un bloque para editarlo</p>
            )}

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
              <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Vista previa en vivo</p>
              <iframe
                title="preview-live"
                srcDoc={effectiveHtml}
                className="h-64 w-full"
                sandbox=""
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>HTML completo</Label>
            <textarea
              className="min-h-[420px] w-full rounded-2xl border border-border/80 bg-white/80 p-4 font-mono text-sm shadow-sm focus:ring-2 focus:ring-gold/30 focus:outline-none"
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Variables con doble llave: {'{{nombre}}'}, {'{{resetLink}}'}, etc.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
            <iframe title="preview-html" srcDoc={htmlCode} className="h-[420px] w-full" sandbox="" />
          </div>
        </div>
      )}

      {preview && (
        <div className="overflow-hidden rounded-2xl border border-gold/30 bg-white p-4">
          <p className="mb-2 text-sm font-medium">Vista previa renderizada — Asunto: {preview.subject}</p>
          <iframe title="preview-final" srcDoc={preview.html} className="h-72 w-full rounded-xl" sandbox="" />
        </div>
      )}

      {meta.slug && (
        <TemplateUsageDocs slug={meta.slug} variables={variables} projectSlug={projectSlug} />
      )}
    </div>
  );
}
