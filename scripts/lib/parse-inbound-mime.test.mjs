import { parseRawEmail } from '../lib/parse-inbound-mime.mjs';
import assert from 'node:assert';

const raw = [
  'From: test@gmail.com',
  'To: agenda@grupohuacas.com',
  'Subject: HOLA',
  'Content-Type: multipart/alternative; boundary="000000000000fad5d10659a3dae6"',
  '',
  '--000000000000fad5d10659a3dae6',
  'Content-Type: text/plain; charset="UTF-8"',
  '',
  'COmo estas?',
  '--000000000000fad5d10659a3dae6',
  'Content-Type: text/html; charset="UTF-8"',
  '',
  '<p>COmo estas?</p>',
  '--000000000000fad5d10659a3dae6--',
].join('\r\n');

const r = parseRawEmail(raw);
assert.equal(r.text, 'COmo estas?');
assert.equal(r.html, '<p>COmo estas?</p>');
console.log('ok', r);
