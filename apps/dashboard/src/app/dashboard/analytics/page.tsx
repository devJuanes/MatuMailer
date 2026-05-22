'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
  const { activeId } = useProjects();
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, queued: 0 });

  useEffect(() => {
    if (!activeId) return;
    api<{ stats: typeof stats }>(`/api/emails/${activeId}/stats`).then((r) => setStats(r.stats));
  }, [activeId]);

  const rate = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;

  const bars = [
    { label: 'Enviados', value: stats.sent, pct: stats.total ? (stats.sent / stats.total) * 100 : 0 },
    { label: 'Fallidos', value: stats.failed, pct: stats.total ? (stats.failed / stats.total) * 100 : 0 },
    { label: 'En cola', value: stats.queued, pct: stats.total ? (stats.queued / stats.total) * 100 : 0 },
  ];

  return (
    <div>
      <PageHeader title="Analíticas" description="Métricas de entrega de correos" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tasa de entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <span className="text-6xl font-bold text-charcoal">{rate}%</span>
              <p className="pb-2 text-muted-foreground">
                {stats.sent} de {stats.total} correos
              </p>
            </div>
            <div className="mt-6 h-4 overflow-hidden rounded-full bg-charcoal/8">
              <div
                className="h-full rounded-full bg-gold transition-all duration-500"
                style={{ width: `${rate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card variant="dark">
          <CardHeader>
            <CardTitle className="text-white">Por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-white/80">{b.label}</span>
                  <span className="font-bold text-gold">{b.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${Math.max(b.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
