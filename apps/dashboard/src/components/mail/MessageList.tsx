'use client';

import {
  SlidersHorizontal,
  Star,
  Pin,
  Paperclip,
  BadgeCheck,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { InboxEmail, MailCategory } from '@/lib/mail/types';

type FilterTab = 'all' | MailCategory;

interface MessageListProps {
  title: string;
  emails: InboxEmail[];
  selectedId: string | null;
  filter: FilterTab;
  pinnedOpen: boolean;
  onSelect: (id: string) => void;
  onFilterChange: (filter: FilterTab) => void;
  onToggleStar: (id: string) => void;
  onTogglePin: (id: string) => void;
  onTogglePinnedSection: () => void;
}

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'primary', label: 'Principal' },
  { id: 'promotions', label: 'Promociones' },
  { id: 'socials', label: 'Social' },
];

export function MessageList({
  title,
  emails,
  selectedId,
  filter,
  pinnedOpen,
  onSelect,
  onFilterChange,
  onToggleStar,
  onTogglePin,
  onTogglePinnedSection,
}: MessageListProps) {
  const pinned = emails.filter((e) => e.pinned);
  const today = emails.filter((e) => !e.pinned && e.section === 'today');
  const yesterday = emails.filter((e) => !e.pinned && e.section === 'yesterday');
  const earlier = emails.filter((e) => !e.pinned && e.section === 'earlier');

  const renderItem = (email: InboxEmail) => {
    const selected = email.id === selectedId;
    return (
      <div
        key={email.id}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(email.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(email.id);
          }
        }}
        className={`group relative flex w-full cursor-pointer gap-2 rounded-xl px-2 py-3 text-left transition-colors ${
          selected ? 'bg-zinc-800/90 ring-1 ring-inset ring-zinc-700/80' : 'hover:bg-zinc-800/50'
        }`}
      >
        {selected && (
          <span className="absolute top-3 bottom-3 left-0 w-0.5 rounded-full bg-blue-500" />
        )}

        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(email.id);
            }}
            className="rounded p-0.5 hover:bg-zinc-700"
            aria-label="Favorito"
          >
            <Star
              size={14}
              className={
                email.starred
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-zinc-600 group-hover:text-zinc-400'
              }
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(email.id);
            }}
            className="rounded p-0.5 hover:bg-zinc-700"
            aria-label="Fijar"
          >
            <Pin
              size={13}
              className={
                email.pinned
                  ? 'fill-zinc-300 text-zinc-300'
                  : 'text-zinc-700 group-hover:text-zinc-500'
              }
            />
          </button>
        </div>

        <div className="relative shrink-0">
          <img src={email.from.avatar} alt="" className="size-10 rounded-full bg-zinc-800" />
          {email.from.online && (
            <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-[#141416] bg-emerald-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <span
                className={`truncate text-sm ${
                  email.unread > 0 ? 'font-semibold text-white' : 'font-medium text-zinc-200'
                }`}
              >
                {email.from.name}
              </span>
              {email.from.verified && (
                <BadgeCheck size={14} className="shrink-0 fill-blue-500 text-white" />
              )}
            </div>
            <span className="shrink-0 text-xs text-zinc-500">{email.dateLabel}</span>
          </div>
          <p
            className={`truncate text-sm ${
              email.unread > 0 ? 'font-medium text-zinc-100' : 'text-zinc-300'
            }`}
          >
            {email.subject}
          </p>
          <p className="truncate text-xs text-zinc-500">{email.preview}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-5">
          {email.hasAttachment && <Paperclip size={14} className="text-zinc-500" />}
          {email.unread > 0 && (
            <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
              {email.unread}
            </span>
          )}
        </div>
      </div>
    );
  };

  const section = (sectionTitle: string, items: InboxEmail[], collapsible = false) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between px-2">
          <button
            type="button"
            onClick={collapsible ? onTogglePinnedSection : undefined}
            className="flex items-center gap-1 text-xs font-semibold tracking-wide text-zinc-400 uppercase"
          >
            {sectionTitle}
            {collapsible && (
              <ChevronDown
                size={14}
                className={`transition-transform ${pinnedOpen ? '' : '-rotate-90'}`}
              />
            )}
          </button>
          {collapsible && (
            <button
              type="button"
              onClick={onTogglePinnedSection}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {pinnedOpen ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {(!collapsible || pinnedOpen) && items.map(renderItem)}
      </div>
    );
  };

  return (
    <section className="flex h-full w-[380px] shrink-0 flex-col border-r border-zinc-800/80 bg-[#141416]">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <button
          type="button"
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Filtros"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full bg-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-700"
          aria-label="Más filtros"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {emails.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            No hay mensajes reales aquí todavía.
          </p>
        ) : (
          <>
            {section('Fijados', pinned, true)}
            {section('Hoy', today)}
            {section('Ayer', yesterday)}
            {section('Anteriores', earlier)}
          </>
        )}
      </div>
    </section>
  );
}
