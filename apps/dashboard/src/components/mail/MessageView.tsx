'use client';

import {
  ArrowLeft,
  Archive,
  AlertOctagon,
  Trash2,
  Star,
  Pin,
  FolderInput,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Smile,
  Reply,
  Paperclip,
  Bold,
  Link2,
  AtSign,
  ArrowUp,
  Mail,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InboxEmail } from '@/lib/mail/types';

interface MessageViewProps {
  email: InboxEmail | null;
  index: number;
  total: number;
  composerAvatar: string;
  sending?: boolean;
  onBack: () => void;
  onArchive: () => void;
  onSpam: () => void;
  onTrash: () => void;
  onToggleStar: () => void;
  onTogglePin: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSend: (text: string) => void;
}

export function MessageView({
  email,
  index,
  total,
  composerAvatar,
  sending = false,
  onBack,
  onArchive,
  onSpam,
  onTrash,
  onToggleStar,
  onTogglePin,
  onPrev,
  onNext,
  onSend,
}: MessageViewProps) {
  const [draft, setDraft] = useState('');
  const [recipient, setRecipient] = useState('');

  useEffect(() => {
    if (!email) return;
    setDraft('');
    setRecipient(email.from.email);
  }, [email]);

  if (!email) {
    return (
      <section className="flex h-full flex-1 items-center justify-center bg-[#0c0c0e]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-600">
            <Mail size={24} />
          </div>
          <p className="text-sm font-medium text-zinc-400">Selecciona un mensaje</p>
          <p className="mt-1 text-xs text-zinc-600">O pulsa Redactar para escribir uno nuevo</p>
        </div>
      </section>
    );
  }

  const toolBtn = (
    label: string,
    onClick: () => void,
    Icon: typeof Archive,
    active = false,
    activeClass = 'text-amber-400',
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`rounded-lg p-2 transition-colors hover:bg-zinc-800 ${
        active ? activeClass : 'text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <Icon
        size={18}
        className={active && Icon === Star ? 'fill-amber-400' : undefined}
        fill={active && Icon === Pin ? 'currentColor' : 'none'}
      />
    </button>
  );

  const bodyHtml = /<[a-z][\s\S]*>/i.test(email.body);

  return (
    <section className="animate-fade-in flex h-full min-w-0 flex-1 flex-col bg-[#0c0c0e]">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-2">
        <div className="flex items-center gap-0.5">
          {toolBtn('Volver', onBack, ArrowLeft)}
          {toolBtn('Archivar', onArchive, Archive)}
          {toolBtn('Spam', onSpam, AlertOctagon)}
          {toolBtn('Papelera', onTrash, Trash2)}
          {toolBtn('Favorito', onToggleStar, Star, email.starred)}
          {toolBtn('Pin', onTogglePin, Pin, email.pinned, 'text-zinc-200')}
          {toolBtn('Mover', () => undefined, FolderInput)}
          {toolBtn('Más', () => undefined, MoreHorizontal)}
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <button
            type="button"
            onClick={onPrev}
            disabled={index <= 0}
            className="rounded-lg p-1.5 hover:bg-zinc-800 disabled:opacity-30"
            aria-label="Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {index + 1} de {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={index >= total - 1}
            className="rounded-lg p-1.5 hover:bg-zinc-800 disabled:opacity-30"
            aria-label="Siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 flex items-start gap-2">
          <span className="mt-2.5 size-2 shrink-0 rounded-full bg-amber-500" />
          <h2 className="text-2xl font-semibold tracking-tight text-white">{email.subject}</h2>
        </div>

        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <img src={email.from.avatar} alt="" className="size-11 rounded-full bg-zinc-800" />
            <div className="min-w-0">
              <p className="font-semibold text-white">{email.from.name}</p>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <span className="truncate">
                  {email.from.email} → {email.to}
                </span>
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="text-right text-xs text-zinc-500">
              <p>{email.dateLabel}</p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onToggleStar}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-amber-400"
              >
                <Star
                  size={16}
                  className={email.starred ? 'fill-amber-400 text-amber-400' : undefined}
                />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Smile size={16} />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Reply size={16} />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>

        {bodyHtml ? (
          <div
            className="prose prose-invert max-w-none text-[15px] leading-7 text-zinc-300"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />
        ) : (
          <div className="prose prose-invert max-w-none">
            {email.body.split('\n').map((line, i) =>
              line.trim() === '' ? (
                <div key={i} className="h-3" />
              ) : (
                <p key={i} className="text-[15px] leading-7 text-zinc-300">
                  {line}
                </p>
              ),
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800/60 px-4 py-3">
        <div className="flex gap-3">
          <img
            src={composerAvatar}
            alt=""
            className="mt-1 size-9 shrink-0 rounded-full bg-zinc-800"
          />
          <div className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-[#141416]">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-2">
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs text-zinc-400 outline-none"
                placeholder="Destinatario"
              />
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Escribe una respuesta…"
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Mención"
                >
                  <AtSign size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Negrita"
                >
                  <Bold size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Enlace"
                >
                  <Link2 size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Emoji"
                >
                  <Smile size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Adjuntar"
                >
                  <Paperclip size={16} />
                </button>
              </div>
              <button
                type="button"
                disabled={!draft.trim() || sending}
                onClick={() => {
                  onSend(draft.trim());
                  setDraft('');
                }}
                className="flex size-9 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
