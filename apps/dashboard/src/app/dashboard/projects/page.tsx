'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { PlanLimitBanner } from '@/components/billing/PlanLimitBanner';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { useProjects } from '@/hooks/use-project';
import { usePlan } from '@/providers/plan-provider';
import { api } from '@/lib/api';
import { projectLimitState, limitMessage } from '@/lib/plan-limits-ui';
import { FolderKanban, Key, Copy, Check, Trash2 } from 'lucide-react';

interface ApiTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  can_copy: boolean;
  created_at: string;
}

export default function ProjectsPage() {
  const { projects, refresh, loading: projectsLoading } = useProjects();
  const { plan, isPremium, refresh: refreshPlan, loading: planLoading } = usePlan();

  const projectCount = projects.length;
  const {
    allowed: allowCreate,
    used: projectUsed,
    max: projectLimit,
  } = projectLimitState(plan, isPremium, projectCount);
  const ready = !projectsLoading && (!planLoading || plan !== null || isPremium);
  const blocked = ready && !allowCreate;
  const canSubmit = ready && allowCreate;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tokensByProject, setTokensByProject] = useState<Record<string, ApiTokenRow[]>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadTokens = useCallback(async (projectId: string) => {
    const res = await api<{ tokens: ApiTokenRow[] }>(`/api/projects/${projectId}/tokens`);
    setTokensByProject((prev) => ({ ...prev, [projectId]: res.tokens }));
  }, []);

  useEffect(() => {
    projects.forEach((p) => {
      loadTokens(p.id).catch(() => {});
    });
  }, [projects, loadTokens]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/\s+/g, '-') }),
      });
      setName('');
      setSlug('');
      setMessage('Proyecto creado correctamente.');
      await refresh();
      await refreshPlan();
    } catch (err) {
      setMessage('');
      setError(err instanceof Error ? err.message : 'No se pudo crear el proyecto');
    }
  }

  async function createToken(projectId: string) {
    await api(`/api/projects/${projectId}/tokens`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Token principal' }),
    });
    await loadTokens(projectId);
    setMessage('Token creado. Usa «Copiar token» cuando lo necesites.');
  }

  async function copyToken(projectId: string, tokenId: string) {
    try {
      const res = await api<{ secret: string }>(
        `/api/projects/${projectId}/tokens/${tokenId}/secret`,
      );
      await navigator.clipboard.writeText(res.secret);
      setCopiedId(tokenId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo copiar');
    }
  }

  async function revokeToken(projectId: string, tokenId: string) {
    await api(`/api/projects/${projectId}/tokens/${tokenId}`, { method: 'DELETE' });
    await loadTokens(projectId);
    setMessage('Token revocado');
  }

  return (
    <div>
      <PageHeader
        title="Proyectos"
        description="Gestiona proyectos y tokens API"
        showProject={false}
      />

      {!isPremium && ready && (
        <PlanLimitBanner
          label="Proyectos"
          used={projectUsed}
          max={projectLimit}
          blocked={blocked}
          showUsage
          description={
            allowCreate
              ? 'Plan gratis: puedes tener 1 proyecto.'
              : limitMessage('proyectos', projectUsed, projectLimit)
          }
        />
      )}

      {!ready && <p className="mb-4 text-sm text-muted-foreground">Verificando tu plan…</p>}

      {message && (
        <p className="mb-4 rounded-2xl bg-gold/15 px-4 py-2 text-sm text-charcoal">{message}</p>
      )}
      {error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          {error.includes('Premium') || error.includes('gratis') ? (
            <UpgradeButton size="sm" />
          ) : null}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className={!canSubmit ? 'opacity-75' : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderKanban className="h-5 w-5 text-gold" />
              Nuevo proyecto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : blocked ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Ya tienes el máximo de proyectos en el plan gratis.
                </p>
                <UpgradeButton className="w-full" label="Más proyectos con Premium" />
              </div>
            ) : (
              <form onSubmit={createProject} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="mi-app"
                    pattern="[a-z0-9-]+"
                  />
                </div>
                <Button type="submit" variant="gold" className="w-full" disabled={!canSubmit}>
                  Crear proyecto
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {projects.map((p) => {
            const tokens = tokensByProject[p.id] ?? [];
            return (
              <Card key={p.id}>
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-charcoal">{p.name}</p>
                      <p className="font-mono text-sm text-muted-foreground">{p.slug}</p>
                    </div>
                    <Button variant="secondary" onClick={() => createToken(p.id)}>
                      <Key className="mr-2 h-4 w-4" />
                      {tokens.length > 0 ? 'Nuevo token' : 'Generar token'}
                    </Button>
                  </div>

                  {tokens.length > 0 && (
                    <div className="space-y-2 border-t border-border/40 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Tokens API (uso en tu código con Bearer)
                      </p>
                      {tokens.map((t) => (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-charcoal/5 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-charcoal">{t.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {t.token_prefix}…
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {t.can_copy ? (
                              <Button
                                size="sm"
                                variant="gold"
                                onClick={() => copyToken(p.id, t.id)}
                              >
                                {copiedId === t.id ? (
                                  <>
                                    <Check className="mr-1 h-4 w-4" />
                                    Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy className="mr-1 h-4 w-4" />
                                    Copiar token
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="self-center text-xs text-muted-foreground">
                                Genera un token nuevo para copiar
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => revokeToken(p.id, t.id)}
                              aria-label="Revocar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
