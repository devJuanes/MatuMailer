'use client';

import { Mail, Send, CheckCircle, XCircle, Zap, Code2, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectSelector } from '@/components/layout/project-selector';
import { useProjects } from '@/hooks/use-project';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SetupStatus {
  smtpConfigured: boolean;
  welcomeTemplate: boolean;
  hasApiToken: boolean;
  testEmailSent: boolean;
  completedCount: number;
  totalSteps: number;
}

export default function DashboardPage() {
  const { active, activeId } = useProjects();
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, queued: 0 });
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [recentLogs, setRecentLogs] = useState<
    { id: string; to_email: string; subject: string; status: string; created_at: string }[]
  >([]);

  useEffect(() => {
    if (!activeId) return;
    api<{ stats: typeof stats }>(`/api/emails/${activeId}/stats`)
      .then((r) => setStats(r.stats))
      .catch(() => {});
    api<{ setup: SetupStatus }>(`/api/projects/${activeId}/setup`)
      .then((r) => setSetup(r.setup))
      .catch(() => {});
    api<{ logs: typeof recentLogs }>(`/api/emails/${activeId}/logs?limit=5`)
      .then((r) => setRecentLogs(r.logs))
      .catch(() => {});
  }, [activeId]);

  const deliveryRate = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;

  const tasks = setup
    ? [
        { label: 'Configurar SMTP', done: setup.smtpConfigured, href: '/dashboard/smtp' },
        {
          label: 'Crear plantilla de bienvenida',
          done: setup.welcomeTemplate,
          href: '/dashboard/templates',
        },
        { label: 'Generar token API', done: setup.hasApiToken, href: '/dashboard/projects' },
        {
          label: 'Enviar correo de prueba',
          done: setup.testEmailSent,
          href: '/dashboard/correo-prueba',
        },
      ]
    : [];

  const completed = setup?.completedCount ?? 0;
  const total = setup?.totalSteps ?? 4;
  const allDone = setup && completed === total;

  return (
    <div className="space-y-8 pt-4">
      {allDone && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gold/40 bg-gradient-to-r from-gold/25 to-white/80 px-6 py-5 shadow-soft">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-gold" />
            <div>
              <p className="font-bold text-charcoal">¡Proyecto listo para producción!</p>
              <p className="text-sm text-muted-foreground">
                SMTP, plantilla, token y prueba completados. Empieza a enviar desde tu app.
              </p>
            </div>
          </div>
          <Button variant="gold" asChild>
            <Link href="/dashboard/documentacion">
              Ver integración API
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Panel de control</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-charcoal md:text-5xl">
            Bienvenido a MatuMailer
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="stat-pill bg-charcoal text-white">
              Entregados <span className="text-gold">{stats.sent}</span>
            </span>
            <span className="stat-pill bg-white/70 text-charcoal border border-white/80">
              En cola <span className="font-bold">{stats.queued}</span>
            </span>
            <span className="stat-pill bg-gold/30 text-charcoal">
              Tasa <span className="font-bold">{deliveryRate}%</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSelector />
          <Button variant="gold" asChild>
            <Link href="/dashboard/projects">Nuevo proyecto</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Correos totales', value: stats.total, icon: Mail },
          { label: 'Entregados', value: stats.sent, icon: CheckCircle, highlight: true },
          { label: 'Fallidos', value: stats.failed, icon: XCircle },
          { label: 'En cola', value: stats.queued, icon: Send },
        ].map((c) => (
          <Card key={c.label} className={c.highlight ? 'ring-2 ring-gold/40' : ''}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-3xl font-bold text-charcoal">{c.value}</p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  c.highlight ? 'bg-gold text-charcoal' : 'bg-charcoal/5 text-charcoal'
                }`}
              >
                <c.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-gold" />
              Inicio rápido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-2xl bg-charcoal/5 p-5 font-mono text-sm leading-relaxed text-charcoal/80">
{`npm install matumailer

import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({
  token: process.env.MATUMAILER_TOKEN,
});

await mail.send({
  to: 'usuario@ejemplo.com',
  template: 'welcome',
  data: { nombre: 'Juan' },
});`}
            </pre>
            <div className="mt-4 flex gap-2">
              <Button variant="default" asChild>
                <Link href="/dashboard/documentacion">Ver API</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/dashboard/templates">Plantillas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card variant="dark">
          <CardHeader>
            <CardTitle className="text-white">
              Configuración
              <span className="ml-2 text-gold">
                {completed}/{total}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task) => (
              <Link
                key={task.label}
                href={task.href}
                className={cn(
                  'flex items-center justify-between rounded-2xl px-4 py-3 transition-colors',
                  task.done ? 'bg-gold/20 hover:bg-gold/25' : 'bg-white/10 hover:bg-white/15',
                )}
              >
                <span
                  className={cn(
                    'text-sm',
                    task.done ? 'text-charcoal font-medium' : 'text-white/90',
                  )}
                >
                  {task.label}
                </span>
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                    task.done ? 'bg-gold text-charcoal' : 'bg-white/20 text-white/60',
                  )}
                >
                  {task.done ? '✓' : '○'}
                </span>
              </Link>
            ))}
            {!activeId && (
              <p className="text-sm text-white/60">Selecciona un proyecto para ver el progreso.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {activeId && recentLogs.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Actividad reciente</CardTitle>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dashboard/logs">Ver todo</Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-charcoal">{log.subject}</p>
                  <p className="text-muted-foreground">{log.to_email}</p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-3 py-0.5 text-xs font-medium',
                    log.status === 'sent' ? 'bg-gold/25 text-charcoal' : 'bg-charcoal/10',
                  )}
                >
                  {log.status === 'sent' ? 'Enviado' : log.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {active && (
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold">
              <Code2 className="h-7 w-7 text-charcoal" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-charcoal">Proyecto activo: {active.name}</p>
              <p className="text-sm text-muted-foreground font-mono">{active.slug}</p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/logs">Ver envíos</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
