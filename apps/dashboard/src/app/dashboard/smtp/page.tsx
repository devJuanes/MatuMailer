'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { PlanLimitBanner } from '@/components/billing/PlanLimitBanner';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { useProjects } from '@/hooks/use-project';
import { usePlan } from '@/providers/plan-provider';
import { api } from '@/lib/api';
import { smtpLimitState, limitMessage } from '@/lib/plan-limits-ui';
import { Server, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliverabilityReport {
  score: number;
  checks: { id: string; ok: boolean; label: string; detail: string }[];
  tips: string[];
}

export default function SmtpPage() {
  const { activeId } = useProjects();
  const { plan, isPremium, refresh: refreshPlan } = usePlan();
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [form, setForm] = useState({
    provider: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
  });
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<DeliverabilityReport | null>(null);
  const [dns, setDns] = useState<{
    domain: string;
    spf: { found: boolean; record?: string };
    dmarc: { found: boolean; record?: string };
    summary: string;
  } | null>(null);

  const smtpUsedCount = plan?.usage.smtpConfigs ?? (hasExistingConfig ? 1 : 0);
  const {
    allowed: allowConfigure,
    used: smtpUsed,
    max: smtpLimit,
  } = smtpLimitState(plan, isPremium, smtpUsedCount, hasExistingConfig);

  function loadDeliverability() {
    if (!activeId) return;
    api<{ report: DeliverabilityReport }>(`/api/smtp/${activeId}/deliverability`)
      .then((r) => setReport(r.report))
      .catch(() => setReport(null));
  }

  useEffect(() => {
    if (!activeId) return;
    api<{
      config: {
        provider: string;
        host: string;
        port: number;
        secure: boolean;
        username: string;
        from_email: string;
        from_name: string | null;
        is_verified: boolean;
      } | null;
    }>(`/api/smtp/${activeId}`)
      .then((r) => {
        if (r.config) {
          setHasExistingConfig(true);
          setForm({
            provider: r.config.provider,
            host: r.config.host,
            port: r.config.port,
            secure: r.config.secure,
            username: r.config.username,
            password: '',
            fromEmail: r.config.from_email,
            fromName: r.config.from_name ?? '',
          });
          setVerified(r.config.is_verified);
          loadDeliverability();
        } else {
          setHasExistingConfig(false);
        }
      })
      .catch(() => {});
  }, [activeId]);

  function syncUsernameFromFrom() {
    if (form.fromEmail.includes('@')) {
      setForm((f) => ({ ...f, username: form.fromEmail.trim() }));
    }
  }

  async function detectProvider() {
    if (!form.fromEmail) return;
    const res = await api<{
      detected: boolean;
      host?: string;
      port?: number;
      provider?: string;
      secure?: boolean;
    }>('/api/smtp/detect', { method: 'POST', body: JSON.stringify({ email: form.fromEmail }) });
    if (res.detected && res.host) {
      setForm((f) => ({
        ...f,
        provider: res.provider ?? f.provider,
        host: res.host!,
        port: res.port ?? f.port,
        secure: res.secure ?? f.secure,
      }));
      setMessage('Proveedor detectado automáticamente');
    }
  }

  async function save() {
    if (!activeId || !allowConfigure) return;
    if (!hasExistingConfig && !form.password.trim()) {
      setMessage('Pega la contraseña de aplicación antes de guardar.');
      return;
    }
    try {
      const res = await api<{
        warnings?: string[];
      }>(`/api/smtp/${activeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          provider: form.provider,
          host: form.host,
          port: Number(form.port),
          secure: form.secure,
          username: form.username.trim(),
          password: form.password.trim() || 'placeholder',
          fromEmail: form.fromEmail.trim(),
          fromName: form.fromName.trim() || undefined,
        }),
      });
      loadDeliverability();
      setHasExistingConfig(true);
      await refreshPlan();
      const warn = res.warnings?.[0];
      setMessage(
        warn
          ? `Guardado. Aviso entregabilidad: ${warn}`
          : 'Configuración guardada. Lista para bandeja principal (SPF alineado).',
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function checkDns() {
    if (!activeId) return;
    try {
      const res = await api<{ dns: typeof dns }>(`/api/smtp/${activeId}/dns`);
      setDns(res.dns);
    } catch {
      setDns(null);
      setMessage('Guarda SMTP antes de revisar DNS.');
    }
  }

  async function testConnection() {
    if (!activeId) return;
    if (!hasExistingConfig && !form.password.trim()) {
      setMessage('Pega la contraseña de aplicación antes de probar.');
      return;
    }
    try {
      const res = await api<{ success: boolean; message?: string }>(`/api/smtp/${activeId}/test`, {
        method: 'POST',
        body: JSON.stringify({
          provider: form.provider,
          host: form.host,
          port: Number(form.port),
          secure: form.secure,
          username: form.username.trim(),
          password: form.password.trim() || 'placeholder',
          fromEmail: form.fromEmail.trim(),
          fromName: form.fromName.trim() || undefined,
        }),
      });
      setVerified(res.success);
      setMessage(res.success ? '¡Conexión verificada!' : (res.message ?? 'La prueba falló'));
      if (res.success) loadDeliverability();
    } catch (e) {
      setVerified(false);
      setMessage((e as Error).message);
    }
  }

  const domainsMatch =
    form.fromEmail.includes('@') &&
    form.username.includes('@') &&
    form.fromEmail.split('@')[1]?.toLowerCase() === form.username.split('@')[1]?.toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración SMTP"
        description="Gmail, Outlook, Zoho o servidor personalizado — optimizado para bandeja principal"
      />

      {!isPremium && (
        <PlanLimitBanner
          label="Configuraciones SMTP"
          used={smtpUsed}
          max={smtpLimit}
          blocked={!allowConfigure}
          showUsage
          description={
            allowConfigure
              ? hasExistingConfig
                ? 'Puedes editar el SMTP de este proyecto.'
                : 'Plan gratis: 1 SMTP por cuenta. El correo no puede usarse en otra cuenta gratis.'
              : limitMessage('configuraciones SMTP', smtpUsed, smtpLimit)
          }
        />
      )}

      <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
        <Card className={!allowConfigure ? 'pointer-events-none opacity-60' : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gold" />
              Servidor de correo
              {verified && (
                <span className="rounded-full bg-gold/30 px-3 py-0.5 text-xs font-medium text-charcoal">
                  Verificado
                </span>
              )}
            </CardTitle>
            <CardDescription>Define cómo se envían los correos de tu proyecto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Correo remitente</Label>
              <div className="flex gap-2">
                <Input
                  value={form.fromEmail}
                  onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                  onBlur={syncUsernameFromFrom}
                  placeholder="tu@gmail.com"
                />
                <Button type="button" variant="secondary" onClick={detectProvider}>
                  Auto-detectar
                </Button>
              </div>
              {!domainsMatch && form.fromEmail && form.username && (
                <p className="text-xs text-amber-800">
                  El remitente y el usuario SMTP deben ser del mismo dominio para no caer en spam.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nombre remitente (visible en bandeja)</Label>
              <Input
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                placeholder="Tu marca o nombre"
              />
            </div>
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <select
                className="input-crextio w-full"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
              >
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="zoho">Zoho</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Puerto</Label>
                <Input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-gold/25 bg-gold/10 p-4 text-sm text-charcoal space-y-3">
              <p className="font-semibold">¿Qué poner en cada campo?</p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                <li>
                  <strong className="text-charcoal">Correo remitente</strong> y{' '}
                  <strong className="text-charcoal">Usuario</strong>: tu correo completo de Gmail u
                  Outlook (ej. <code className="rounded bg-white/70 px-1">tu@gmail.com</code>). En
                  Gmail suele ser el mismo valor en ambos campos.
                </li>
                <li>
                  <strong className="text-charcoal">Contraseña</strong>: no uses tu contraseña
                  normal. En Gmail crea una <strong>contraseña de aplicación</strong> en Google →
                  Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones. Pega aquí esa
                  clave de 16 caracteres.
                </li>
                <li>
                  <strong className="text-charcoal">Host / Puerto</strong>: con Auto-detectar se
                  rellenan solos (Gmail:{' '}
                  <code className="rounded bg-white/70 px-1">smtp.gmail.com</code> puerto{' '}
                  <code className="rounded bg-white/70 px-1">587</code>).
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label>Usuario SMTP</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="tu@gmail.com (mismo correo que remitente)"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña de aplicación</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Clave de 16 caracteres de Google — vacío = mantener actual"
              />
            </div>
            {message && (
              <p className="rounded-2xl bg-gold/15 px-4 py-2 text-sm text-charcoal">{message}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={save} disabled={!allowConfigure}>
                Guardar
              </Button>
              <Button
                variant="secondary"
                onClick={testConnection}
                disabled={!hasExistingConfig && !allowConfigure}
              >
                Probar conexión
              </Button>
            </div>
            {!allowConfigure && (
              <div className="pt-2">
                <UpgradeButton className="pointer-events-auto" label="SMTP en más proyectos" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-gold" />
              Entregabilidad
              {report && (
                <span className="ml-auto rounded-full bg-gold/30 px-3 py-0.5 text-sm font-bold text-charcoal">
                  {report.score}%
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Cada envío incluye versión texto + HTML, cabeceras correctas y validación SPF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {report ? (
              <>
                <ul className="space-y-2">
                  {report.checks.map((c) => (
                    <li
                      key={c.id}
                      className={cn(
                        'rounded-xl px-3 py-2',
                        c.ok ? 'bg-gold/15 text-charcoal' : 'bg-charcoal/5 text-muted-foreground',
                      )}
                    >
                      <span className="font-medium">
                        {c.ok ? '✓' : '○'} {c.label}
                      </span>
                      <p className="mt-0.5 text-xs">{c.detail}</p>
                    </li>
                  ))}
                </ul>
                <div>
                  <p className="font-semibold text-charcoal mb-2">Recomendaciones</p>
                  <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                    {report.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <Button type="button" variant="secondary" className="w-full" onClick={checkDns}>
                  Revisar SPF / DMARC en DNS
                </Button>
                {dns && (
                  <div className="rounded-xl bg-charcoal/5 p-3 text-xs space-y-2">
                    <p className="font-medium text-charcoal">{dns.summary}</p>
                    <p>
                      SPF: {dns.spf.found ? '✓' : '✗'}{' '}
                      {dns.spf.record && (
                        <code className="block mt-1 break-all opacity-80">{dns.spf.record}</code>
                      )}
                    </p>
                    <p>
                      DMARC: {dns.dmarc.found ? '✓' : '✗'}{' '}
                      {dns.dmarc.record && (
                        <code className="block mt-1 break-all opacity-80">{dns.dmarc.record}</code>
                      )}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Guarda SMTP para ver el análisis.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
