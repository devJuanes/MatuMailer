'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { listEmailLogs } from '@/lib/db/email-logs';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface EmailLog {
  id: string;
  to_email: string;
  subject: string;
  template_slug: string | null;
  status: string;
  error_message?: string | null;
  user_message?: string | null;
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
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId) return;
    listEmailLogs(activeId, { limit: 50 }).then(setLogs);
  }, [activeId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de correos"
        description="Historial con mensajes claros cuando algo falla"
      />

      <div className="space-y-3">
        {logs.map((log) => {
          const human =
            log.user_message ||
            (log.status === 'failed'
              ? 'No se pudo enviar este correo.'
              : log.status === 'sent'
                ? 'Entregado al servidor SMTP.'
                : null);
          const open = openId === log.id;
          return (
            <Card key={log.id} className={cn(log.status === 'failed' && 'border-red-200')}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-charcoal">
                      {log.status === 'failed'
                        ? `No se envió a ${log.to_email}${human ? ` porque ${human.charAt(0).toLowerCase()}${human.slice(1)}` : '.'}`
                        : `${statusLabels[log.status] ?? log.status}: ${log.to_email}`}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{log.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.template_slug ? `Plantilla /${log.template_slug} · ` : ''}
                      {new Date(log.created_at).toLocaleString('es')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        statusStyles[log.status] ?? 'bg-muted',
                      )}
                    >
                      {statusLabels[log.status] ?? log.status}
                    </span>
                    {(log.error_message || log.user_message) && (
                      <button
                        type="button"
                        className="rounded-full p-1 hover:bg-charcoal/5"
                        onClick={() => setOpenId(open ? null : log.id)}
                        aria-label="Detalle técnico"
                      >
                        {open ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {open && (
                  <div className="mt-4 rounded-xl bg-charcoal/5 p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {log.user_message && (
                      <p className="mb-2 font-sans text-sm text-charcoal">{log.user_message}</p>
                    )}
                    {log.error_message || 'Sin detalle técnico adicional'}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {logs.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Envíos recientes</CardTitle>
            </CardHeader>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aún no hay correos enviados
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
