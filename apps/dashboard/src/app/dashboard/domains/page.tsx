'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { cn } from '@/lib/utils';
import {
  createDomain,
  deleteDomain,
  getDomain,
  listDomains,
  refreshDomainDns,
  setDefaultDomain,
  verifyDomain,
  type DomainDnsRecord,
  type DomainRecord,
  type DomainRegion,
  type DomainVerifyResult,
  type DomainWithRecords,
} from '@/lib/db/domains';
import { copyBindZoneFile, downloadBindZoneFile } from '@/lib/dns-zone';
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  ClipboardCopy,
  Copy,
  Download,
  Globe,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react';

const REGION_OPTIONS: Array<{ id: DomainRegion; label: string; description: string }> = [
  { id: 'us-east-1', label: 'Virginia (US East)', description: 'Latencia óptima para América' },
  { id: 'sa-east-1', label: 'São Paulo (SA East)', description: 'Ideal para Suramérica' },
  { id: 'eu-west-1', label: 'Irlanda (EU West)', description: 'Cumplimiento GDPR-friendly' },
];

const STATUS_META: Record<
  DomainRecord['status'],
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-900', icon: CircleDashed },
  verifying: { label: 'Verificando', className: 'bg-blue-100 text-blue-900', icon: Loader2 },
  verified: {
    label: 'Verificado',
    className: 'bg-emerald-100 text-emerald-900',
    icon: CheckCircle2,
  },
  failed: { label: 'Falló', className: 'bg-red-100 text-red-800', icon: AlertCircle },
  disabled: { label: 'Desactivado', className: 'bg-charcoal/10 text-charcoal/70', icon: X },
};

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="group flex w-full items-center justify-between gap-2 rounded-xl bg-charcoal/5 px-3 py-2 text-left font-mono text-xs text-charcoal/80 transition-colors hover:bg-charcoal/10"
    >
      <span className="break-all">{value}</span>
      <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-charcoal transition-colors group-hover:bg-gold">
        {copied ? '✓ Copiado' : <Copy className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function CapBadge({
  label,
  state,
}: {
  label: string;
  state?: 'ready' | 'pending' | 'warning' | 'blocked';
}) {
  const styles = {
    ready: 'bg-emerald-100 text-emerald-900',
    warning: 'bg-amber-100 text-amber-950',
    pending: 'bg-charcoal/10 text-charcoal/70',
    blocked: 'bg-red-100 text-red-800',
  };
  const icons = {
    ready: '✓',
    warning: '⚠',
    pending: '…',
    blocked: '✗',
  };
  const s = state ?? 'pending';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', styles[s])}>
      {icons[s]} {label}
    </span>
  );
}

function RecordsTable({ records }: { records: DomainDnsRecord[] }) {
  const sorted = useMemo(
    () => [...records].sort((a, b) => a.type.localeCompare(b.type) || a.host.localeCompare(b.host)),
    [records],
  );
  if (!records.length) {
    return <p className="text-sm text-muted-foreground">No hay registros DNS pendientes.</p>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-charcoal/5 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Host</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {sorted.map((record) => (
            <tr key={record.id} className="bg-white/60 align-top">
              <td className="px-4 py-3">
                <span className="rounded-md bg-charcoal/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-charcoal">
                  {record.type}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-charcoal/80">{record.host}</td>
              <td className="px-4 py-3">
                <CopyableValue value={record.value} />
                {record.priority !== null && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Priority: <strong>{record.priority}</strong>
                  </p>
                )}
                {record.last_value && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Detectado en DNS:{' '}
                    <code className="break-all rounded bg-charcoal/5 px-1 py-0.5 text-[10px]">
                      {record.last_value}
                    </code>
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    record.status === 'verified' && 'bg-emerald-100 text-emerald-900',
                    record.status === 'failed' && 'bg-red-100 text-red-800',
                    record.status === 'pending' && 'bg-amber-100 text-amber-900',
                  )}
                >
                  {record.status === 'verified' && <CheckCircle2 className="h-3 w-3" />}
                  {record.status === 'failed' && <AlertCircle className="h-3 w-3" />}
                  {record.status === 'pending' && <CircleDashed className="h-3 w-3" />}
                  {record.status === 'pending'
                    ? 'Pendiente'
                    : record.status === 'verified'
                      ? 'Verificado'
                      : 'Falló'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DomainCard({
  domain,
  onChanged,
}: {
  domain: DomainRecord;
  projectId?: string;
  onChanged: () => void;
}) {
  const [details, setDetails] = useState<DomainWithRecords | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [makingDefault, setMakingDefault] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<DomainVerifyResult['capabilities']>();

  useEffect(() => {
    let cancelled = false;
    setLoadingDetails(true);
    getDomain(domain.id)
      .then((d) => !cancelled && setDetails(d))
      .catch(() => !cancelled && setDetails(null))
      .finally(() => !cancelled && setLoadingDetails(false));
    return () => {
      cancelled = true;
    };
  }, [domain.id]);

  const meta = STATUS_META[domain.status];
  const StatusIcon = meta.icon;

  async function handleVerify() {
    setError('');
    setInfo('');
    setWarnings([]);
    setVerifying(true);
    try {
      const result = await verifyDomain(domain.id);
      setDetails(result.domain);
      setCapabilities(result.capabilities);
      setWarnings(result.warnings ?? []);
      if (result.verified) {
        setInfo(result.message ?? 'Dominio listo para enviar.');
        if (result.warnings?.length) {
          setWarnings(result.warnings);
        }
      } else {
        setError(result.message ?? 'Faltan registros DNS obligatorios (SPF y/o DKIM).');
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verificación falló');
    } finally {
      setVerifying(false);
    }
  }

  async function handleRefreshDns() {
    setError('');
    setInfo('');
    setRefreshing(true);
    try {
      const result = await refreshDomainDns(domain.id);
      setDetails(result.domain);
      setInfo(
        result.message ??
          'Registros regenerados. Actualiza el DNS en tu proveedor y luego Re-verifica.',
      );
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron regenerar los DNS');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminar el dominio ${domain.domain}? Esto borrará sus claves DKIM.`)) return;
    setDeleting(true);
    setError('');
    try {
      await deleteDomain(domain.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
      setDeleting(false);
    }
  }

  async function handleSetDefault() {
    setMakingDefault(true);
    setError('');
    try {
      await setDefaultDomain(domain.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar como default');
    } finally {
      setMakingDefault(false);
    }
  }

  function handleExportZone() {
    if (!details?.records.length) {
      setError('No hay registros DNS para exportar. Espera a que carguen o actualiza.');
      return;
    }
    setError('');
    downloadBindZoneFile(domain.domain, details.records);
    setInfo(
      'Descargado .txt para Hostinger. Importa SIN marcar “Reemplazar”. Si el preview sigue en Not Found, añade los 5 registros a mano (más fiable).',
    );
  }

  async function handleCopyZone() {
    if (!details?.records.length) {
      setError('No hay registros DNS para copiar.');
      return;
    }
    setError('');
    try {
      await copyBindZoneFile(domain.domain, details.records);
      setInfo('Zona BIND copiada al portapapeles.');
    } catch {
      setError('No se pudo copiar. Prueba Exportar zona DNS.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-gold" />
            {domain.domain}
            <span
              className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', meta.className)}
            >
              <StatusIcon className="mr-1 inline h-3 w-3" />
              {meta.label}
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExportZone}
              disabled={loadingDetails || !details?.records.length}
            >
              <Download className="mr-1 h-4 w-4" />
              Exportar para Hostinger
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopyZone}
              disabled={loadingDetails || !details?.records.length}
            >
              <ClipboardCopy className="mr-1 h-4 w-4" />
              Copiar zona
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRefreshDns}
              disabled={refreshing || verifying}
            >
              <RefreshCcw className={cn('mr-1 h-4 w-4', refreshing && 'animate-spin')} />
              {refreshing ? 'Actualizando…' : 'Actualizar registros DNS'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleVerify}
              disabled={verifying || domain.status === 'verifying'}
            >
              <RefreshCcw className={cn('mr-1 h-4 w-4', verifying && 'animate-spin')} />
              {verifying ? 'Verificando…' : 'Re-verificar DNS'}
            </Button>
            {domain.status === 'verified' && (
              <Button size="sm" variant="gold" onClick={handleSetDefault} disabled={makingDefault}>
                <Star className="mr-1 h-4 w-4" />
                {makingDefault ? 'Guardando…' : 'Marcar como default'}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
        <CardDescription>
          DKIM selector <code className="rounded bg-charcoal/5 px-1">{domain.dkim_selector}</code> ·
          region {domain.region} · creado {new Date(domain.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
        {info && <p className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{info}</p>}
        {warnings.length > 0 && (
          <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-950">
            <p className="font-semibold">Advertencias DNS</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {capabilities && (
          <div className="flex flex-wrap gap-2">
            <CapBadge label="Envío" state={capabilities.sending} />
            <CapBadge label="Recepción" state={capabilities.receiving} />
            <CapBadge label="DMARC" state={capabilities.dmarc} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          <strong>Envío</strong> requiere SPF + DKIM. <strong>Recepción</strong> requiere MX →{' '}
          <code>matumailer.matubyte.com</code>. Si usas Zoho u otro correo, elimina sus MX o
          MatuMailer no recibirá los mensajes. El CNAME <code>rp-…</code> es return-path (rebotes).
        </p>
        {loadingDetails ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando registros DNS…
          </div>
        ) : details ? (
          <RecordsTable records={details.records} />
        ) : (
          <p className="text-sm text-muted-foreground">No se pudieron cargar los registros.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DomainsPage() {
  const { activeId } = useProjects();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ domain: string; region: DomainRegion }>({
    domain: '',
    region: 'us-east-1',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refreshDomains() {
    if (!activeId) return;
    setLoading(true);
    try {
      setDomains(await listDomains(activeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando dominios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshDomains();
  }, [activeId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const created = await createDomain(activeId, form);
      setSuccess(
        `Dominio ${created.domain} añadido. Copia los registros DNS y haz clic en "Re-verificar".`,
      );
      setForm({ domain: '', region: 'us-east-1' });
      setShowForm(false);
      await refreshDomains();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear';
      if (message.includes('DOMAIN_EXISTS')) {
        setError('Ese dominio ya existe en este proyecto.');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dominios personalizados"
        description="Añade tu dominio y configura DNS (SPF, DKIM, DMARC, return-path y MX). Puedes exportar un archivo de zona BIND e importarlo en Cloudflare u otro proveedor. El MX debe apuntar a matumailer.matubyte.com."
      />

      {success && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{success}</p>
      )}
      {error && <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5 text-gold" />
                Añadir dominio
              </CardTitle>
              <CardDescription>
                Te generamos SPF, DKIM, DMARC, return-path y MX (prioridad 10 →
                matumailer.matubyte.com). El MX es obligatorio para recibir correos en la bandeja.
              </CardDescription>
            </div>
            <Button variant="secondary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? 'Cancelar' : 'Nuevo dominio'}
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Dominio</Label>
                <Input
                  required
                  placeholder="destin.com"
                  value={form.domain}
                  onChange={(e) =>
                    setForm({ ...form, domain: e.target.value.toLowerCase().trim() })
                  }
                  pattern="^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$"
                />
                <p className="text-xs text-muted-foreground">
                  También puedes añadir un subdominio como <code>mail.destin.com</code>.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Región de envío</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {REGION_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className={cn(
                        'cursor-pointer rounded-2xl border p-3 text-left transition-colors',
                        form.region === opt.id
                          ? 'border-gold/60 bg-gold/10'
                          : 'border-border/60 bg-white/60 hover:bg-white',
                      )}
                    >
                      <input
                        type="radio"
                        name="region"
                        value={opt.id}
                        checked={form.region === opt.id}
                        onChange={() => setForm({ ...form, region: opt.id })}
                        className="sr-only"
                      />
                      <p className="text-sm font-semibold text-charcoal">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting ? 'Generando…' : 'Generar dominio y claves'}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      {!activeId && (
        <p className="text-sm text-muted-foreground">Selecciona un proyecto para empezar.</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando dominios…
        </div>
      )}

      <div className="space-y-4">
        {domains.length === 0 && !loading && (
          <Card>
            <CardContent className="space-y-3 py-10 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-gold" />
              <h3 className="text-lg font-semibold text-charcoal">Tu primer dominio</h3>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Añade un dominio y configura los registros DNS que te mostraremos. Cuando esté
                verificado, podrás enviar desde <code>support@tu-dominio.com</code> y el correo se
                firmará con tu DKIM privado.
              </p>
              <Button variant="gold" onClick={() => setShowForm(true)}>
                Empezar
              </Button>
            </CardContent>
          </Card>
        )}

        {domains.map((domain) => (
          <DomainCard key={domain.id} domain={domain} onChanged={refreshDomains} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cómo enviar desde tu dominio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Una vez verificado y marcado como default, todos los envíos usarán tu dominio. También
            puedes sobrescribir el remitente en cada llamada:
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-charcoal/95 p-4 text-xs text-white">
            {`import { MatuMailer } from 'matumailer';

const mail = new MatuMailer({ token: process.env.MATUMAILER_TOKEN! });

await mail.send({
  to: 'user@example.com',
  from: 'support@destin.com',
  fromName: 'Soporte Destin',
  subject: 'Hola {{name}}',
  html: '<p>Hola {{name}}</p>',
  data: { name: 'Juan' },
  replyTo: 'hello@destin.com',
});`}
          </pre>
          <p>
            También puedes gestionar dominios vía SDK: <code>mail.listDomains(projectId)</code>,{' '}
            <code>mail.createDomain(...)</code>, <code>mail.verifyDomain(id)</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
