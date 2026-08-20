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
  Sparkles,
  Smile,
  Reply,
  Paperclip,
  Bold,
  Link2,
  AtSign,
  ArrowUp,
  Wand2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InboxEmail } from '@/lib/mail/types';

interface MessageViewProps {
  email: InboxEmail | null;
  index: number;
  total: number;
  smartResponses: boolean;
  composerAvatar: string;
  onBack: () => void;
  onArchive: () => void;
  onSpam: () => void;
  onTrash: () => void;
  onToggleStar: () => void;
  onTogglePin: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSend: (text: string) => void;
  onQuickReply: (text: string) => void;
}

export function MessageView({
  email,
  index,
  total,
  smartResponses,
  composerAvatar,
  onBack,
  onArchive,
  onSpam,
  onTrash,
  onToggleStar,
  onTogglePin,
  onPrev,
  onNext,
  onSend,
  onQuickReply,
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
            <Sparkles size={24} />
          </div>
          <p className="text-sm font-medium text-zinc-400">Select a message to read</p>
          <p className="mt-1 text-xs text-zinc-600">Your inbox is ready when you are</p>
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
          {toolBtn('Back', onBack, ArrowLeft)}
          {toolBtn('Archive', onArchive, Archive)}
          {toolBtn('Spam', onSpam, AlertOctagon)}
          {toolBtn('Trash', onTrash, Trash2)}
          {toolBtn('Star', onToggleStar, Star, email.starred)}
          {toolBtn('Pin', onTogglePin, Pin, email.pinned, 'text-zinc-200')}
          {toolBtn('Move', () => undefined, FolderInput)}
          {toolBtn('More', () => undefined, MoreHorizontal)}
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <button
            type="button"
            onClick={onPrev}
            disabled={index <= 0}
            className="rounded-lg p-1.5 hover:bg-zinc-800 disabled:opacity-30"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {index + 1} of {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={index >= total - 1}
            className="rounded-lg p-1.5 hover:bg-zinc-800 disabled:opacity-30"
            aria-label="Next"
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

        {email.summary && (
          <div className="mb-5 rounded-2xl border border-amber-900/25 bg-[#2a2118] px-4 py-3.5">
            <div className="mb-2 flex items-center gap-2 text-amber-400">
              <Sparkles size={16} />
              <span className="text-sm font-semibold text-amber-100">
                Summary of {email.from.name}&apos;s Email
              </span>
            </div>
            <p className="text-sm leading-relaxed text-amber-100/70">{email.summary}</p>
          </div>
        )}

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
                  {email.from.email} → to: {email.to}
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

        {smartResponses && email.quickReplies.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {email.quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => {
                  setDraft(reply);
                  onQuickReply(reply);
                }}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
              >
                {reply}
              </button>
            ))}
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
                placeholder="Recipient"
              />
              <button
                type="button"
                onClick={() =>
                  setDraft(
                    `Thanks for reaching out about "${email.subject}". I'd love to continue this conversation — when works for you?`,
                  )
                }
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white"
              >
                <Wand2 size={12} className="text-amber-400" />
                Generate quick reply
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Write a reply…"
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Mention"
                >
                  <AtSign size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Bold"
                >
                  <Bold size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Link"
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
                  aria-label="Attach"
                >
                  <Paperclip size={16} />
                </button>
              </div>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={() => {
                  onSend(draft.trim());
                  setDraft('');
                }}
                className="flex size-9 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send"
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
