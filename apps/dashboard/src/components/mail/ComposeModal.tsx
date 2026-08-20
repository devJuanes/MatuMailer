'use client';

import { useEffect, useState } from 'react';
import { X, Send } from 'lucide-react';
import type { MailAccount } from '@/lib/mail/types';

interface ComposeModalProps {
  open: boolean;
  accounts: MailAccount[];
  defaultFrom?: string;
  defaultTo?: string;
  defaultSubject?: string;
  sending?: boolean;
  onClose: () => void;
  onSend: (payload: { from: string; to: string; subject: string; text: string }) => void;
}

export function ComposeModal({
  open,
  accounts,
  defaultFrom,
  defaultTo = '',
  defaultSubject = '',
  sending = false,
  onClose,
  onSend,
}: ComposeModalProps) {
  const [from, setFrom] = useState(defaultFrom || accounts[0]?.email || '');
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open) return;
    setFrom(defaultFrom || accounts[0]?.email || '');
    setTo(defaultTo);
    setSubject(defaultSubject);
    setText('');
  }, [open, defaultFrom, defaultTo, defaultSubject, accounts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-[#141416] shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Redactar correo</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <label className="block text-xs text-zinc-500">
            Desde
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.email}>
                  {a.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-500">
            Para
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="email"
              placeholder="destino@ejemplo.com"
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Asunto
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del mensaje"
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Mensaje
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Escribe tu mensaje…"
              className="mt-1 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={sending || !from || !to || !subject.trim() || !text.trim()}
            onClick={() => onSend({ from, to, subject: subject.trim(), text: text.trim() })}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
          >
            <Send size={16} />
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
