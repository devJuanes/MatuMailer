'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  Send,
  Bold,
  Italic,
  Underline,
  Link2,
  List,
  ListOrdered,
  Smile,
  Paperclip,
} from 'lucide-react';
import type { MailAccount } from '@/lib/mail/types';

interface ComposePaneProps {
  accounts: MailAccount[];
  defaultFrom?: string;
  defaultTo?: string;
  defaultSubject?: string;
  sending?: boolean;
  onClose: () => void;
  onSend: (payload: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }) => void;
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export function ComposePane({
  accounts,
  defaultFrom,
  defaultTo = '',
  defaultSubject = '',
  sending = false,
  onClose,
  onSend,
}: ComposePaneProps) {
  const [from, setFrom] = useState(defaultFrom || accounts[0]?.email || '');
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFrom(defaultFrom || accounts[0]?.email || '');
    setTo(defaultTo);
    setSubject(defaultSubject);
    if (editorRef.current) editorRef.current.innerHTML = '';
  }, [defaultFrom, defaultTo, defaultSubject, accounts]);

  const tool = (label: string, onClick: () => void, Icon: typeof Bold) => (
    <button
      type="button"
      onClick={() => {
        editorRef.current?.focus();
        onClick();
      }}
      className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      aria-label={label}
    >
      <Icon size={16} />
    </button>
  );

  const handleSend = () => {
    const html = (editorRef.current?.innerHTML || '').trim();
    const text = (editorRef.current?.innerText || '').trim();
    if (!from || !to || !subject.trim() || !text) return;
    onSend({ from, to, subject: subject.trim(), text, html: html || `<p>${text}</p>` });
  };

  return (
    <section className="animate-fade-in flex h-full min-w-0 flex-1 flex-col bg-[#0c0c0e]">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
            Redactar
          </p>
          <h2 className="text-lg font-semibold text-white">Nuevo mensaje</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3 border-b border-zinc-800/60 px-4 py-3">
        <label className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="w-14 shrink-0">De</span>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          >
            {accounts.length === 0 ? (
              <option value="">Sin alias activo</option>
            ) : (
              accounts.map((a) => (
                <option key={a.id} value={a.email}>
                  {a.email}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="w-14 shrink-0">Para</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            type="email"
            placeholder="destino@correo.com"
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="w-14 shrink-0">Asunto</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Asunto del mensaje"
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </label>
      </div>

      <div className="flex items-center gap-0.5 border-b border-zinc-800/60 px-3 py-1.5">
        {tool('Negrita', () => exec('bold'), Bold)}
        {tool('Cursiva', () => exec('italic'), Italic)}
        {tool('Subrayado', () => exec('underline'), Underline)}
        {tool(
          'Enlace',
          () => {
            const url = window.prompt('URL del enlace');
            if (url) exec('createLink', url);
          },
          Link2,
        )}
        {tool('Lista', () => exec('insertUnorderedList'), List)}
        {tool('Lista numerada', () => exec('insertOrderedList'), ListOrdered)}
        {tool('Emoji', () => exec('insertText', '🙂'), Smile)}
        <span className="mx-1 h-4 w-px bg-zinc-800" />
        {tool('Adjuntar', () => undefined, Paperclip)}
      </div>

      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline
        data-placeholder="Escribe tu mensaje…"
        className="compose-editor flex-1 overflow-y-auto px-5 py-4 text-[15px] leading-7 text-zinc-200 outline-none empty:before:pointer-events-none empty:before:text-zinc-600 empty:before:content-[attr(data-placeholder)]"
        suppressContentEditableWarning
      />

      <div className="flex items-center justify-end gap-2 border-t border-zinc-800/60 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          Descartar
        </button>
        <button
          type="button"
          disabled={sending || !from || !to || !subject.trim()}
          onClick={handleSend}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          <Send size={16} />
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </section>
  );
}
