#!/usr/bin/env node
/**
 * Comprueba si un email está listo para recepción en Postfix/MatuMailer.
 * Uso: node scripts/check-inbound-recipient.mjs agenda@grupohuacas.com
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@devjuanes/matuclient';
import { resolveMx } from 'dns/promises';

const email = (process.argv[2] || '').toLowerCase().trim();
if (!email || !email.includes('@')) {
  console.error('Uso: node scripts/check-inbound-recipient.mjs user@dominio.com');
  process.exit(1);
}

const [local, domain] = email.split('@');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

function loadEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const mapDir = process.env.POSTFIX_MAP_DIR || '/etc/postfix';
const mapPath = `${mapDir}/matumailer_mailboxes`;

console.log(`\n=== Recepción: ${email} ===\n`);

// MX
try {
  const mx = await resolveMx(domain);
  console.log('MX públicos:');
  for (const r of mx.sort((a, b) => a.priority - b.priority)) {
    console.log(`  ${r.priority} ${r.exchange}`);
  }
} catch (e) {
  console.log('MX: error DNS', e.message);
}

// Postfix map
if (existsSync(mapPath)) {
  const raw = readFileSync(mapPath, 'utf8');
  const found = raw.split(/\r?\n/).some((l) => l.trim().toLowerCase().startsWith(`${email} `));
  console.log(`\nPostfix map (${mapPath}): ${found ? '✓ ENCONTRADO' : '✗ NO ENCONTRADO → 550 en RCPT TO'}`);
} else {
  console.log(`\nPostfix map: no existe ${mapPath}`);
}

// MatuDB alias
const url = process.env.MATUDB_URL;
const projectId = process.env.MATUDB_PROJECT_ID;
const apiKey = process.env.MATUDB_API_KEY;
if (url && projectId && apiKey) {
  const db = createClient({ url, projectId, apiKey });
  const { data: alias } = await db
    .from('mailer_domain_aliases')
    .select('id,full_email,is_active,domain_id')
    .eq('full_email', email)
    .maybeSingle();
  if (alias) {
    const { data: dom } = await db
      .from('mailer_domains')
      .select('domain,status')
      .eq('id', alias.domain_id)
      .maybeSingle();
    console.log(`\nMatuMailer alias: ✓ ${alias.full_email} active=${alias.is_active}`);
    console.log(`Dominio: ${dom?.domain} status=${dom?.status}`);
    if (dom?.status !== 'verified') {
      console.log('⚠ Dominio no verified → no se sincroniza a Postfix');
    }
  } else {
    console.log(`\nMatuMailer alias: ✗ NO EXISTE → crea ${email} en Dashboard → Aliases`);
  }
} else {
  console.log('\nMatuDB: faltan credenciales en .env');
}

console.log('\nSi Postfix map dice NO ENCONTRADO pero el alias existe:');
console.log('  sudo node scripts/sync-postfix-inbound.mjs\n');
