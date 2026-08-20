'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MailSidebar } from '@/components/mail/MailSidebar';
import { MessageList } from '@/components/mail/MessageList';
import { MessageView } from '@/components/mail/MessageView';
import { useProjects } from '@/hooks/use-project';
import { getToken } from '@/lib/api';
import { listAliases } from '@/lib/db/aliases';
import { signOut } from '@/lib/auth-matudb';
import {
  aliasesToAccounts,
  fetchInboundMessages,
  patchInboundMessage,
} from '@/lib/mail/inbound-api';
import type {
  AccountId,
  InboxEmail,
  MailAccount,
  MailCategory,
  MailFolder,
} from '@/lib/mail/types';

type FilterTab = 'all' | MailCategory;

export default function MailInboxPage() {
  const router = useRouter();
  const { activeId, projects } = useProjects();
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [folder, setFolder] = useState<MailFolder>('inbox');
  const [account, setAccount] = useState<AccountId | 'all'>('all');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [smartResponses, setSmartResponses] = useState(true);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const load = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const [aliasRows, messages] = await Promise.all([
        listAliases(activeId, { activeOnly: true }),
        fetchInboundMessages(activeId),
      ]);
      setAccounts(aliasesToAccounts(aliasRows));
      setEmails(messages);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo cargar la bandeja');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [activeId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleEmails = useMemo(() => {
    let list = emails.filter((e) => {
      if (folder === 'favorite') return e.starred && e.folder !== 'trash' && e.folder !== 'spam';
      return e.folder === folder;
    });
    if (account !== 'all') list = list.filter((e) => e.account === account);
    if (filter !== 'all') list = list.filter((e) => e.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.from.name.toLowerCase().includes(q) ||
          e.from.email.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.timestamp - a.timestamp;
    });
  }, [emails, folder, account, filter, search]);

  useEffect(() => {
    if (visibleEmails.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleEmails.some((e) => e.id === selectedId)) {
      setSelectedId(visibleEmails[0].id);
    }
  }, [visibleEmails, selectedId]);

  const selected = visibleEmails.find((e) => e.id === selectedId) ?? null;
  const selectedIndex = selected ? visibleEmails.findIndex((e) => e.id === selected.id) : -1;

  const updateLocal = (id: string, patch: Partial<InboxEmail>) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const persist = async (id: string, updates: Parameters<typeof patchInboundMessage>[1]) => {
    try {
      await patchInboundMessage(id, updates);
    } catch {
      showToast('No se pudo guardar el cambio');
      void load();
    }
  };

  const inboxCount = emails.filter((e) => e.folder === 'inbox' && e.unread).length;
  const favoriteCount = emails.filter((e) => e.starred).length;
  const project = projects.find((p) => p.id === activeId);
  const userName = project?.name || 'Matu Mail';
  const userEmail = accounts[0]?.email || '';
  const userAvatar = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(userName)}&backgroundColor=c0aede`;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#0c0c0e]">
      <MailSidebar
        folder={folder}
        account={account}
        search={search}
        inboxCount={inboxCount}
        favoriteCount={favoriteCount}
        accounts={accounts}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        onFolderChange={setFolder}
        onAccountChange={setAccount}
        onSearchChange={setSearch}
        onSearchFocus={() => undefined}
        onGoApi={() => router.push('/dashboard')}
        onLogout={async () => {
          await signOut();
          router.push('/login');
        }}
      />

      <MessageList
        title={folder === 'inbox' ? 'Inbox' : folder}
        emails={visibleEmails}
        selectedId={selectedId}
        filter={filter}
        smartResponses={smartResponses}
        pinnedOpen={pinnedOpen}
        onSelect={(id) => {
          setSelectedId(id);
          const msg = emails.find((e) => e.id === id);
          if (msg?.unread) {
            updateLocal(id, { unread: 0 });
            void persist(id, { unread: false });
          }
        }}
        onFilterChange={setFilter}
        onToggleSmart={() => setSmartResponses((v) => !v)}
        onToggleStar={(id) => {
          const msg = emails.find((e) => e.id === id);
          if (!msg) return;
          updateLocal(id, { starred: !msg.starred });
          void persist(id, { starred: !msg.starred });
        }}
        onTogglePin={(id) => {
          const msg = emails.find((e) => e.id === id);
          if (!msg) return;
          updateLocal(id, { pinned: !msg.pinned });
          void persist(id, { pinned: !msg.pinned });
        }}
        onTogglePinnedSection={() => setPinnedOpen((v) => !v)}
      />

      <MessageView
        email={selected}
        index={Math.max(selectedIndex, 0)}
        total={visibleEmails.length}
        smartResponses={smartResponses}
        composerAvatar={userAvatar}
        onBack={() => setSelectedId(null)}
        onArchive={() => {
          if (!selected) return;
          updateLocal(selected.id, { folder: 'archive' });
          void persist(selected.id, { folder: 'archive' });
          showToast('Archivado');
        }}
        onSpam={() => {
          if (!selected) return;
          updateLocal(selected.id, { folder: 'spam' });
          void persist(selected.id, { folder: 'spam' });
          showToast('Marcado como spam');
        }}
        onTrash={() => {
          if (!selected) return;
          updateLocal(selected.id, { folder: 'trash' });
          void persist(selected.id, { folder: 'trash' });
          showToast('Movido a papelera');
        }}
        onToggleStar={() => {
          if (!selected) return;
          updateLocal(selected.id, { starred: !selected.starred });
          void persist(selected.id, { starred: !selected.starred });
        }}
        onTogglePin={() => {
          if (!selected) return;
          updateLocal(selected.id, { pinned: !selected.pinned });
          void persist(selected.id, { pinned: !selected.pinned });
        }}
        onPrev={() => {
          if (selectedIndex > 0) setSelectedId(visibleEmails[selectedIndex - 1].id);
        }}
        onNext={() => {
          if (selectedIndex < visibleEmails.length - 1) {
            setSelectedId(visibleEmails[selectedIndex + 1].id);
          }
        }}
        onSend={() => showToast('Respuesta en cola (próximamente)')}
        onQuickReply={() => undefined}
      />

      {loading && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400 ring-1 ring-zinc-700">
            Cargando bandeja…
          </span>
        </div>
      )}
      {toast && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-zinc-800 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
