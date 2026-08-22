#!/usr/bin/env node
/**
 * Postfix pipe → MatuMailer inbound ingest.
 *
 * Uso en master.cf (ejemplo):
 *   matumailer unix - n n - - pipe
 *     flags=FR user=matumailer argv=/usr/bin/node /root/apps/MatuMailer/scripts/inbound-postfix-pipe.mjs
 *
 * Env:
 *   INBOUND_API_URL=https://matumailer.matubyte.com/api/inbound/ingest
 *   INBOUND_WEBHOOK_SECRET=...
 */
import { stdin } from 'node:process';
import { parseRawEmail } from './lib/parse-inbound-mime.mjs';

const API_URL =
  process.env.INBOUND_API_URL || 'https://matumailer.matubyte.com/api/inbound/ingest';
const SECRET = process.env.INBOUND_WEBHOOK_SECRET || '';

/** Postfix pasa ${recipient} como argv[2] */
const ARG_RECIPIENT = process.argv[2] || '';

function parseHeaders(raw) {
  const headers = {};
  const lines = raw.split(/\r?\n/);
  let i = 0;
  let last = '';
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') break;
    if (/^\s/.test(line) && last) {
      headers[last] += ' ' + line.trim();
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    last = line.slice(0, idx).trim().toLowerCase();
    headers[last] = line.slice(idx + 1).trim();
  }
  return { headers, bodyStart: i + 1, lines };
}

async function main() {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const { headers, bodyStart, lines } = parseHeaders(raw);
  const bodyRaw = lines.slice(bodyStart).join('\n');
  const { text, html } = parseRawEmail(raw);

  const to =
    ARG_RECIPIENT ||
    process.env.RECIPIENT ||
    headers['delivered-to'] ||
    headers['x-original-to'] ||
    headers.to ||
    '';
  const from = headers.from || '';
  const subject = headers.subject || '';
  const messageId = headers['message-id'] || undefined;

  const toEmail = String(to)
    .replace(/.*</, '')
    .replace(/>.*/, '')
    .trim()
    .toLowerCase();

  if (!toEmail || !from) {
    console.error('inbound-pipe: missing to/from');
    process.exit(75);
  }

  const looksHtml = Boolean(html?.trim());
  const payload = {
    to: toEmail,
    from,
    subject,
    messageId,
    headers,
    ...(looksHtml ? { html: html.trim() } : {}),
    ...(text?.trim() ? { text: text.trim() } : !looksHtml && bodyRaw ? { text: bodyRaw } : {}),
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`inbound-pipe: ${res.status} ${text}`);
    process.exit(75);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(75);
});
