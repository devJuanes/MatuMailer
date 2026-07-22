/**
 * Aplica migrate-messaging-upgrade.sql en MatuDB.
 * Uso: node packages/database/scripts/apply-messaging-upgrade.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) throw new Error('No se encontró .env');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

loadEnv();

const url = process.env.MATUDB_URL?.replace(/\/$/, '');
const projectId = process.env.MATUDB_PROJECT_ID;
const apiKey = process.env.MATUDB_API_KEY;
const sql = readFileSync(resolve(__dirname, '../sql/migrate-messaging-upgrade.sql'), 'utf8');

const res = await fetch(`${url}/api/projects/${projectId}/sql`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: apiKey },
  body: JSON.stringify({ query: sql }),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Error:', res.status, json.message ?? JSON.stringify(json));
  process.exit(1);
}
console.log('Migración messaging-upgrade aplicada.');
