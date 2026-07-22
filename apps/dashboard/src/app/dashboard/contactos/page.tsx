'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import { Trash2, UserPlus } from 'lucide-react';

interface Contact {
  id: string;
  email: string;
  name: string | null;
}

export default function ContactosPage() {
  const { activeId } = useProjects();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [importJson, setImportJson] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    if (!activeId) return;
    api<{ contacts: Contact[] }>(`/api/contacts/${activeId}`)
      .then((r) => setContacts(r.contacts))
      .catch(() => setContacts([]));
  }

  useEffect(() => {
    load();
  }, [activeId]);

  async function addContact() {
    if (!activeId || !email) return;
    try {
      await api(`/api/contacts/${activeId}`, {
        method: 'POST',
        body: JSON.stringify({ email, name: name || undefined }),
      });
      setEmail('');
      setName('');
      setMessage('Contacto agregado');
      load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function importContacts() {
    if (!activeId || !importJson.trim()) return;
    try {
      const parsed = JSON.parse(importJson);
      const list = Array.isArray(parsed) ? parsed : (parsed.contacts ?? parsed.users ?? []);
      const res = await api<{ imported: number }>(`/api/contacts/${activeId}/import`, {
        method: 'POST',
        body: JSON.stringify({ contacts: list }),
      });
      setMessage(`Importados: ${res.imported}`);
      setImportJson('');
      load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!activeId) return;
    await api(`/api/contacts/${activeId}/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contactos"
        description="Agenda de destinatarios para plantillas y envíos por grupo"
      />
      {message && (
        <p className="rounded-2xl bg-gold/15 px-4 py-2 text-sm text-charcoal">{message}</p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-gold" />
              Nuevo contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ana Pérez"
              />
            </div>
            <Button onClick={addContact}>Agregar</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Importar JSON</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="input-crextio min-h-[140px] w-full font-mono text-xs"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='[{"email":"a@b.com","name":"Ana"}]'
            />
            <Button variant="secondary" onClick={importContacts}>
              Importar
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{contacts.length} contactos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-charcoal">{c.name || 'Sin nombre'}</p>
                  <p className="text-muted-foreground">{c.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {!contacts.length && (
              <li className="py-8 text-center text-muted-foreground">Aún no hay contactos</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
