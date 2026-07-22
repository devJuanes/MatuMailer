/**
 * Aplica schema.sql en MatuDB vía POST /api/projects/:id/sql
 * Uso: node packages/database/scripts/apply-schema.mjs
 * Requiere MATUDB_URL, MATUDB_PROJECT_ID, MATUDB_API_KEY en .env raíz.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) throw new Error('No se encontró .env en la raíz del monorepo');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim();
    process.env[key] = value;
  }
}

loadEnv();

const url = process.env.MATUDB_URL?.replace(/\/$/, '');
const projectId = process.env.MATUDB_PROJECT_ID;
const apiKey = process.env.MATUDB_API_KEY;

if (!url || !projectId || !apiKey) {
  console.error('Faltan MATUDB_URL, MATUDB_PROJECT_ID o MATUDB_API_KEY en .env');
  process.exit(1);
}

const schemaPath = resolve(__dirname, '../sql/schema.sql');
const dropLegacyPath = resolve(__dirname, '../sql/migrate-drop-legacy-projects.sql');
const sql =
  readFileSync(schemaPath, 'utf8') + '\n\n' + readFileSync(dropLegacyPath, 'utf8');

const endpoint = `${url}/api/projects/${projectId}/sql`;
console.log(`Aplicando schema en ${endpoint} ...`);

const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: apiKey,
  },
  body: JSON.stringify({ query: sql }),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Error:', res.status, json.message ?? JSON.stringify(json));
  process.exit(1);
}

console.log('Schema aplicado correctamente.');
