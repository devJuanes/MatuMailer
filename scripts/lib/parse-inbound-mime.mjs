/**
 * Extrae text/html de un cuerpo MIME (multipart/alternative, mixed, etc.).
 * Sin dependencias externas — usado por el pipe Postfix inbound.
 */

function decodeQuotedPrintable(input) {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBody(body, encoding) {
  const enc = (encoding || '7bit').toLowerCase().trim();
  if (enc === 'base64') {
    try {
      return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8');
    } catch {
      return body;
    }
  }
  if (enc === 'quoted-printable') {
    return decodeQuotedPrintable(body);
  }
  return body;
}

function parsePartHeaders(block) {
  const lines = block.split(/\r?\n/);
  const headers = {};
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
  const body = lines.slice(i + 1).join('\n').trim();
  return { headers, body };
}

function getBoundary(contentType) {
  const m = /boundary\s*=\s*("([^"]+)"|([^;\s]+))/i.exec(contentType || '');
  return m ? (m[2] || m[3]).trim() : null;
}

function parseMultipart(body, boundary) {
  const delim = `--${boundary}`;
  const parts = body.split(delim).map((p) => p.replace(/^[\r\n]+/, '').replace(/--[\r\n]*$/, '').trim());
  let text = '';
  let html = '';

  for (const part of parts) {
    if (!part || part === '--') continue;
    const { headers, body: partBody } = parsePartHeaders(part);
    const ct = headers['content-type'] || 'text/plain';
    const enc = headers['content-transfer-encoding'];
    const decoded = decodeBody(partBody, enc);

    if (/^multipart\//i.test(ct)) {
      const nested = parseMimeBody(decoded, ct);
      if (nested.html) html = nested.html;
      if (nested.text) text = nested.text;
      continue;
    }
    if (/text\/html/i.test(ct) && decoded) {
      html = decoded;
    } else if (/text\/plain/i.test(ct) && decoded) {
      text = decoded;
    }
  }

  return { text, html };
}

/**
 * @param {string} body
 * @param {string} [contentTypeHeader] Content-Type del mensaje
 * @returns {{ text: string, html: string }}
 */
export function parseMimeBody(body, contentTypeHeader = '') {
  const ct = contentTypeHeader || 'text/plain';
  const boundary = getBoundary(ct);

  if (boundary && /multipart\//i.test(ct)) {
    const { text, html } = parseMultipart(body, boundary);
    if (html || text) return { text, html };
  }

  if (/text\/html/i.test(ct)) {
    return { text: '', html: decodeBody(body, '') };
  }

  const inlineBoundary = body.match(/^--([0-9a-f]{8,})/m);
  if (inlineBoundary) {
    const { text, html } = parseMultipart(body, inlineBoundary[1]);
    if (html || text) return { text, html };
  }

  return { text: body.trim(), html: '' };
}

/**
 * Parsea mensaje RFC822 completo (headers + body).
 * @param {string} raw
 * @returns {{ text: string, html: string }}
 */
export function parseRawEmail(raw) {
  const { headers, bodyStart, lines } = parseTopHeaders(raw);
  const body = lines.slice(bodyStart).join('\n');
  const contentType = headers['content-type'] || '';
  const encoding = headers['content-transfer-encoding'];
  const decoded = decodeBody(body, encoding);
  const { text, html } = parseMimeBody(decoded, contentType);

  if (html) return { text: text || stripHtml(html), html };
  if (text && !/^--[0-9a-f]{8,}/m.test(text)) return { text, html: '' };

  const cleaned = cleanMimeArtifacts(text || body);
  return { text: cleaned, html: '' };
}

function parseTopHeaders(raw) {
  const lines = raw.split(/\r?\n/);
  const headers = {};
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

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMimeArtifacts(raw) {
  return raw
    .replace(/^--[0-9a-f]{8,}[\s\S]*?Content-Type:[^\n]+/gim, '')
    .replace(/^--[0-9a-f]{8,}--\s*$/gm, '')
    .replace(/Content-Transfer-Encoding:[^\n]+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
