'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EmailLog {
  id: string;
  to_email: string;
  subject: string;
  template_slug: string | null;
  status: string;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  sent: 'Enviado',
  failed: 'Fallido',
  queued: 'En cola',
  bounced: 'Rebotado',
};

const statusStyles: Record<string, string> = {
  sent: 'bg-gold/25 text-charcoal',
  failed: 'bg-red-100 text-red-700',
  queued: 'bg-charcoal/10 text-charcoal',
  bounced: 'bg-amber-100 text-amber-800',
};

export default function LogsPage() {
  const { activeId } = useProjects();
  const [logs, setLogs] = useState<EmailLog[]>([]);

  useEffect(() => {
    if (!activeId) return;
    api<{ logs: EmailLog[] }>(`/api/emails/${activeId}/logs?limit=50`).then((r) => setLogs(r.logs));
  }, [activeId]);

  return (
    <div>
      <PageHeader title="Registro de correos" description="Historial de envíos de tu proyecto" />

      <Card>
        <CardHeader>
          <CardTitle>Envíos recientes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="pb-4 pr-4 font-medium">Destinatario</th>
                <th className="pb-4 pr-4 font-medium">Asunto</th>
                <th className="pb-4 pr-4 font-medium">Plantilla</th>
                <th className="pb-4 pr-4 font-medium">Estado</th>
                <th className="pb-4 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/40">
                  <td className="py-4 pr-4 font-mono text-xs text-charcoal">{log.to_email}</td>
                  <td className="max-w-[200px] truncate py-4 pr-4">{log.subject}</td>
                  <td className="py-4 pr-4 text-muted-foreground">{log.template_slug ?? '—'}</td>
                  <td className="py-4 pr-4">
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        statusStyles[log.status] ?? 'bg-muted',
                      )}
                    >
                      {statusLabels[log.status] ?? log.status}
                    </span>
                  </td>
                  <td className="py-4 text-muted-foreground">
                    {new Date(log.created_at).toLocaleString('es')}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    Aún no hay correos enviados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
