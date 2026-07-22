'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { useProjects } from '@/hooks/use-project';
import { api } from '@/lib/api';
import { UsersRound } from 'lucide-react';

interface Contact {
  id: string;
  email: string;
  name: string | null;
}
interface Group {
  id: string;
  name: string;
  description: string | null;
  member_count?: number;
}

export default function GruposPage() {
  const { activeId } = useProjects();
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  function load() {
    if (!activeId) return;
    api<{ groups: Group[] }>(`/api/contacts/${activeId}/groups`).then((r) => setGroups(r.groups));
    api<{ contacts: Contact[] }>(`/api/contacts/${activeId}`).then((r) => setContacts(r.contacts));
  }

  useEffect(() => {
    load();
  }, [activeId]);

  async function createGroup() {
    if (!activeId || !name.trim()) return;
    try {
      await api(`/api/contacts/${activeId}/groups`, {
        method: 'POST',
        body: JSON.stringify({ name, description, contactIds: selected }),
      });
      setName('');
      setDescription('');
      setSelected([]);
      setMessage('Grupo creado');
      load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function saveMembers() {
    if (!activeId || !activeGroup) return;
    await api(`/api/contacts/${activeId}/groups/${activeGroup}`, {
      method: 'PUT',
      body: JSON.stringify({ contactIds: selected }),
    });
    setMessage('Miembros actualizados');
    load();
  }

  async function removeGroup(id: string) {
    if (!activeId) return;
    await api(`/api/contacts/${activeId}/groups/${id}`, { method: 'DELETE' });
    if (activeGroup === id) setActiveGroup(null);
    load();
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grupos"
        description="Segmenta contactos y envía campañas a un grupo completo"
      />
      {message && (
        <p className="rounded-2xl bg-gold/15 px-4 py-2 text-sm text-charcoal">{message}</p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-gold" />
              Nuevo grupo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Clientes VIP"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span>
                    {c.name || c.email} <span className="text-muted-foreground">({c.email})</span>
                  </span>
                </label>
              ))}
              {!contacts.length && (
                <p className="text-sm text-muted-foreground">Primero agrega contactos</p>
              )}
            </div>
            <Button onClick={createGroup}>Crear grupo</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tus grupos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {groups.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={async () => {
                    setActiveGroup(g.id);
                    if (!activeId) return;
                    const r = await api<{ contacts: Contact[] }>(
                      `/api/contacts/${activeId}/groups/${g.id}/members`,
                    );
                    setSelected(r.contacts.map((c) => c.id));
                  }}
                >
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.member_count ?? 0} miembros · {g.description || 'Sin descripción'}
                  </p>
                </button>
                <Button variant="ghost" size="sm" onClick={() => removeGroup(g.id)}>
                  Eliminar
                </Button>
              </div>
            ))}
            {!groups.length && (
              <p className="text-sm text-muted-foreground">Crea tu primer grupo</p>
            )}
            {activeGroup && (
              <Button className="w-full" variant="secondary" onClick={saveMembers}>
                Guardar miembros del grupo seleccionado
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
