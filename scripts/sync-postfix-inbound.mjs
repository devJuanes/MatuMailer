#!/usr/bin/env node
/**
 * Sincroniza aliases verificados → mapas Postfix (recepción).
 *
 * Escribe:
 *   /etc/postfix/matumailer_domains
 *   /etc/postfix/matumailer_mailboxes
 * Luego: postmap + reload
 *
 * Env: MATUDB_*, POSTFIX_MAP_DIR (default /etc/postfix), POSTFIX_RELOAD=1
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@devjuanes/matuclient';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const MAP_DIR = process.env.POSTFIX_MAP_DIR || '/etc/postfix';
const url = process.env.MATUDB_URL;
const projectId = process.env.MATUDB_PROJECT_ID;
const apiKey = process.env.MATUDB_API_KEY;

if (!url || !projectId || !apiKey) {
  console.error('Faltan MATUDB_URL / MATUDB_PROJECT_ID / MATUDB_API_KEY');
  process.exit(1);
}

const db = createClient({ url, projectId, apiKey });

async function main() {
  const { data: domains, error: dErr } = await db
    .from('mailer_domains')
    .select('id,domain,status')
    .eq('status', 'verified');
  if (dErr) throw new Error(dErr.message);

  const domainIds = (domains ?? []).map((d) => d.id);
  const domainById = Object.fromEntries((domains ?? []).map((d) => [d.id, d.domain]));

  let aliases = [];
  if (domainIds.length) {
    const { data, error } = await db
      .from('mailer_domain_aliases')
      .select('full_email,domain_id,is_active')
      .eq('is_active', true)
      .in('domain_id', domainIds);
    if (error) throw new Error(error.message);
    aliases = data ?? [];
  }

  mkdirSync(MAP_DIR, { recursive: true });

  const domainsMap = [...new Set((domains ?? []).map((d) => d.domain))]
    .map((d) => `${d} OK`)
    .join('\n');

  const mailboxesMap = aliases
    .filter((a) => domainById[a.domain_id])
    .map((a) => `${a.full_email.toLowerCase()} ${domainById[a.domain_id]}/`)
    .join('\n');

  const domainsPath = `${MAP_DIR}/matumailer_domains`;
  const mailboxesPath = `${MAP_DIR}/matumailer_mailboxes`;
  writeFileSync(domainsPath, domainsMap ? domainsMap + '\n' : '');
  writeFileSync(mailboxesPath, mailboxesMap ? mailboxesMap + '\n' : '');

  console.log(`Dominios: ${(domains ?? []).length}`);
  console.log(`Aliases:  ${aliases.length}`);
  console.log(`→ ${domainsPath}`);
  console.log(`→ ${mailboxesPath}`);

  if (process.env.POSTFIX_RELOAD === '0') {
    console.log('POSTFIX_RELOAD=0 — skip postmap/reload');
    return;
  }

  try {
    execSync(`postmap ${domainsPath}`, { stdio: 'inherit' });
    execSync(`postmap ${mailboxesPath}`, { stdio: 'inherit' });
    execSync('postfix reload', { stdio: 'inherit' });
    console.log('✓ Postfix actualizado');
  } catch (e) {
    console.error('postmap/reload falló (¿permisos root?):', e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
