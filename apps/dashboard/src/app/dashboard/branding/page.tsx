'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import { Palette } from 'lucide-react';

export default function BrandingPage() {
  const { activeId } = useProjects();
  const [form, setForm] = useState({
    company_name: '',
    logo_url: '',
    primary_color: '#c9a227',
    header_html: '',
    footer_html: '',
    tracking_enabled: true,
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!activeId) return;
    api<{ branding: typeof form & { tracking_enabled: boolean } }>(`/api/branding/${activeId}`)
      .then((r) => {
        const b = r.branding;
        setForm({
          company_name: b.company_name ?? '',
          logo_url: b.logo_url ?? '',
          primary_color: b.primary_color ?? '#c9a227',
          header_html: b.header_html ?? '',
          footer_html: b.footer_html ?? '',
          tracking_enabled: b.tracking_enabled ?? true,
        });
      })
      .catch(() => {});
  }, [activeId]);

  async function save() {
    if (!activeId) return;
    try {
      await api(`/api/branding/${activeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          company_name: form.company_name || null,
          logo_url: form.logo_url || null,
          primary_color: form.primary_color,
          header_html: form.header_html || null,
          footer_html: form.footer_html || null,
          tracking_enabled: form.tracking_enabled,
        }),
      });
      setMessage('Marca guardada. Se aplicará al renderizar plantillas.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marca del proyecto"
        description="Logo, color, header y footer globales para todas las plantillas"
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-gold" />
            Brand kit
          </CardTitle>
          <CardDescription>
            Variables disponibles: {'{{logo}}'}, {'{{companyName}}'}, {'{{primaryColor}}'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre de empresa</Label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>URL del logo</Label>
            <Input
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label>Color primario</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                className="h-10 w-14 p-1"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              />
              <Input
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Header HTML (opcional)</Label>
            <textarea
              className="input-crextio min-h-[80px] w-full font-mono text-xs"
              value={form.header_html}
              onChange={(e) => setForm({ ...form, header_html: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Footer HTML (opcional)</Label>
            <textarea
              className="input-crextio min-h-[80px] w-full font-mono text-xs"
              value={form.footer_html}
              onChange={(e) => setForm({ ...form, footer_html: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.tracking_enabled}
              onChange={(e) => setForm({ ...form, tracking_enabled: e.target.checked })}
            />
            Activar seguimiento de aperturas y clics
          </label>
          {message && <p className="text-sm text-charcoal">{message}</p>}
          <Button onClick={save}>Guardar marca</Button>
        </CardContent>
      </Card>
    </div>
  );
}
