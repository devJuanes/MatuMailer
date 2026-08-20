'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AtSign, Copy, Loader2, Star, StarOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { listDomains, type DomainRecord } from '@/lib/db/domains';
import { createAlias, deleteAlias, listAliases, updateAlias, type Alias } from '@/lib/db/aliases';
import { cn } from '@/lib/utils';

/**
 * Página de gestión de aliases (`info@dominio.com`, `support@dominio.com`, ...).
 *
 *  - Lista aliases agrupados por dominio verificado.
 *  - Permite crear / editar / activar / marcar default / eliminar.
 *  - Copia `full_email` al portapapeles con un click.
 *
 * Los aliases son la identidad de envío: cualquier `from` que pases al SDK/API
 * tiene que estar aquí.
 */
export default function AliasesPage() {
  const { activeId } = useProjects();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ domainId: '', localPart: '', displayName: '', replyTo: '' });
  const [submitting, setSubmitting] = useState(false);

  const verifiedDomains = useMemo(() => domains.filter((d) => d.status === 'verified'), [domains]);

  const refresh = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    setError('');
    try {
      const [d, a] = await Promise.all([listDomains(activeId), listAliases(activeId, {})]);
      setDomains(d);
      setAliases(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los aliases');
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !form.domainId || !form.localPart) return;
    setSubmitting(true);
    setError('');
    try {
      await createAlias(activeId, {
        domainId: form.domainId,
        localPart: form.localPart.toLowerCase().trim(),
        displayName: form.displayName.trim() || null,
        replyTo: form.replyTo.trim() || null,
        isDefault: aliases.filter((a) => a.domain_id === form.domainId).length === 0,
      });
      setForm({ domainId: '', localPart: '', displayName: '', replyTo: '' });
      setShowForm(false);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el alias';
      setError(msg.includes('ALIAS_EXISTS') ? 'Ya existe ese local-part en este dominio.' : msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este alias?')) return;
    try {
      await deleteAlias(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  async function handleToggleActive(a: Alias) {
    try {
      await updateAlias(a.id, { isActive: !a.is_active });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  }

  async function handleSetDefault(a: Alias) {
    try {
      await updateAlias(a.id, { isDefault: true });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar como default');
    }
  }

  if (!activeId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Aliases"
          description="Identidades de envío para tu dominio verificado."
        />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Selecciona un proyecto para empezar.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aliases"
        description="Crea identidades de envío (info@dominio.com, hola@, soporte@). Marca una como remitente predeterminado para no tener que indicar `from` en la API."
      />

      {error && <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

      {verifiedDomains.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">Necesitas un dominio verificado para crear aliases.</p>
          <p className="mt-1">
            Agrega y verifica un dominio en{' '}
            <Link href="/dashboard/domains" className="underline">
              Dominios
            </Link>{' '}
            antes de crear aliases.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AtSign className="h-5 w-5 text-gold" />
                Nuevo alias
              </CardTitle>
              <CardDescription>
                La parte local es lo que va antes del `@` (ej: <code>info</code>). Solo letras
                minúsculas, números, punto, guión bajo, <code>+</code> y <code>-</code>.
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowForm((s) => !s)}
              disabled={verifiedDomains.length === 0}
            >
              {showForm ? 'Cancelar' : 'Nuevo alias'}
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dominio</label>
                  <select
                    required
                    value={form.domainId}
                    onChange={(e) => setForm({ ...form, domainId: e.target.value })}
                    className="input-crextio w-full"
                  >
                    <option value="">— Selecciona —</option>
                    {verifiedDomains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.domain}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Parte local</label>
                  <div className="flex items-center gap-2">
                    <input
                      required
                      pattern="[a-z0-9._+-]+"
                      value={form.localPart}
                      onChange={(e) => setForm({ ...form, localPart: e.target.value })}
                      placeholder="info"
                      className="input-crextio w-full"
                    />
                    <span className="text-sm text-muted-foreground">
                      @
                      {form.domainId
                        ? domains.find((d) => d.id === form.domainId)?.domain
                        : 'dominio'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display name (opcional)</label>
                  <input
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Equipo de Soporte"
                    className="input-crextio w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reply-To por defecto (opcional)</label>
                  <input
                    type="email"
                    value={form.replyTo}
                    onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
                    placeholder="hola@otro-dominio.com"
                    className="input-crextio w-full"
                  />
                </div>
              </div>
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting ? 'Creando…' : 'Crear alias'}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando aliases…
        </div>
      )}

      <div className="space-y-4">
        {verifiedDomains.map((d) => {
          const list = aliases.filter((a) => a.domain_id === d.id);
          return (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {d.domain}
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                    verificado
                  </span>
                </CardTitle>
                <CardDescription>
                  {list.length} alias{list.length === 1 ? '' : 'es'}
                  {list.some((a) => a.is_default) && (
                    <>
                      {' '}
                      · default:{' '}
                      <code className="rounded bg-charcoal/5 px-1">
                        {list.find((a) => a.is_default)?.full_email}
                      </code>
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay aliases para este dominio. Crea el primero arriba.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((a) => (
                      <li
                        key={a.id}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/40 bg-white/60 px-4 py-3',
                          !a.is_active && 'opacity-60',
                        )}
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => copy(a.full_email)}
                            className="group flex items-center gap-2 font-mono text-sm font-medium text-charcoal"
                          >
                            {a.full_email}
                            <span className="rounded-md bg-charcoal/5 px-1.5 py-0.5 text-[10px] font-sans text-charcoal/70 group-hover:bg-gold/30">
                              {copied === a.full_email ? '✓ copiado' : <Copy className="h-3 w-3" />}
                            </span>
                          </button>
                          {a.display_name && (
                            <p className="text-xs text-muted-foreground">
                              Display name: {a.display_name}
                            </p>
                          )}
                          {a.reply_to && (
                            <p className="text-xs text-muted-foreground">Reply-To: {a.reply_to}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {a.is_default ? (
                            <span className="rounded-full bg-gold/30 px-2 py-0.5 text-xs font-medium text-charcoal">
                              <Star className="mr-1 inline h-3 w-3" />
                              remitente predeterminado
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSetDefault(a)}
                            >
                              <StarOff className="mr-1 h-3.5 w-3.5" />
                              Marcar como remitente predeterminado
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={a.is_active ? 'secondary' : 'gold'}
                            onClick={() => handleToggleActive(a)}
                          >
                            {a.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(a.id)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cómo se usan</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/95 p-4 text-xs text-white">
            {`import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({ token: process.env.MATUMAILER_TOKEN });

await mail.send({
  to: 'cliente@ejemplo.com',
  // Sin \`from\`: usa el default alias del proyecto
  // Con \`from\`: usa ese alias (debe estar activo)
  from: 'soporte@destin.com',
  subject: 'Hola {{name}}',
  html: '<p>Hola {{name}}</p>',
  data: { name: 'Juan' },
});`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
