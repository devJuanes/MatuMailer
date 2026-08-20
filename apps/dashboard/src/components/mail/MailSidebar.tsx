'use client';

import {
  Inbox,
  Bookmark,
  Send,
  ChevronDown,
  ChevronRight,
  Search,
  MessageSquarePlus,
  Archive,
  Trash2,
  AlertOctagon,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import type { AccountId, MailAccount, MailFolder } from '@/lib/mail/types';

export type NavSection = MailFolder;

interface MailSidebarProps {
  folder: MailFolder;
  account: AccountId | 'all';
  search: string;
  inboxCount: number;
  favoriteCount: number;
  accounts: MailAccount[];
  userName: string;
  userEmail: string;
  userAvatar: string;
  onFolderChange: (folder: MailFolder) => void;
  onAccountChange: (account: AccountId | 'all') => void;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  onGoApi: () => void;
  onLogout: () => void;
}

export function MailSidebar({
  folder,
  account,
  search,
  inboxCount,
  favoriteCount,
  accounts,
  userName,
  userEmail,
  userAvatar,
  onFolderChange,
  onAccountChange,
  onSearchChange,
  onSearchFocus,
  onGoApi,
  onLogout,
}: MailSidebarProps) {
  const navItem = (
    id: MailFolder,
    label: string,
    Icon: typeof Inbox,
    badge?: number,
    accountScope: AccountId | 'all' = 'all',
  ) => {
    const active = folder === id && account === accountScope;
    return (
      <button
        type="button"
        onClick={() => {
          onFolderChange(id);
          onAccountChange(accountScope);
        }}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          active
            ? 'bg-zinc-800 text-white'
            : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
        }`}
      >
        <Icon size={18} strokeWidth={1.75} />
        <span className="flex-1 text-left font-medium">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-zinc-800/80 bg-[#121214]">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <img src={userAvatar} alt={userName} className="size-10 rounded-full bg-zinc-800" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{userName}</p>
          <p className="truncate text-xs text-zinc-500">{userEmail || 'Matu Mail'}</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5">
          <Search size={16} className="shrink-0 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onSearchFocus}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            ⌘K
          </kbd>
        </label>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {navItem('inbox', 'Inbox', Inbox, inboxCount)}
        {navItem('favorite', 'Favorite', Bookmark, favoriteCount)}
        {navItem('sent', 'Sent', Send)}
        {navItem('archive', 'Archive', Archive)}
        {navItem('spam', 'Spam', AlertOctagon)}
        {navItem('trash', 'Trash', Trash2)}

        {accounts.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
              Aliases
            </p>
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onAccountChange(a.email);
                  onFolderChange('inbox');
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-zinc-800/50 ${
                  account === a.email ? 'bg-zinc-800/60 text-white' : 'text-zinc-300'
                }`}
              >
                <span className="size-2 rounded-full" style={{ background: a.color }} />
                <span className="flex-1 truncate text-left">{a.label}</span>
                <ChevronRight size={14} className="text-zinc-500" />
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="space-y-0.5 border-t border-zinc-800/80 px-2 py-3">
        <button
          type="button"
          onClick={onGoApi}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <LayoutDashboard size={18} strokeWidth={1.75} />
          <span>Modo API</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <MessageSquarePlus size={18} strokeWidth={1.75} />
          <span>Leave feedback</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <LogOut size={18} strokeWidth={1.75} />
          <span>Cerrar sesión</span>
        </button>
        <button
          type="button"
          onClick={() => onAccountChange('all')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400"
        >
          <ChevronDown size={14} />
          <span>Ver todos los aliases</span>
        </button>
      </div>
    </aside>
  );
}
