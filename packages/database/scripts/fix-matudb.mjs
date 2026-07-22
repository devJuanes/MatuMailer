/**
 * Diagnóstico y reparación del schema MatuMailer en MatuDB.
 * Uso: node packages/database/scripts/fix-matudb.mjs
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
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

async function runSql(query, label) {
  const url = process.env.MATUDB_URL.replace(/\/$/, '');
  const projectId = process.env.MATUDB_PROJECT_ID;
  const apiKey = process.env.MATUDB_API_KEY;
  const endpoint = `${url}/api/projects/${projectId}/sql`;

  console.log(`\n── ${label} ──`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ query }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Error:', res.status, json.message ?? JSON.stringify(json));
    return null;
  }
  const rows = json.data?.rows ?? [];
  if (rows.length) console.table(rows);
  else console.log('OK (sin filas)');
  return json;
}

async function testDataApi(table, params = '') {
  const url = process.env.MATUDB_URL.replace(/\/$/, '');
  const projectId = process.env.MATUDB_PROJECT_ID;
  const apiKey = process.env.MATUDB_API_KEY;
  const endpoint = `${url}/api/projects/${projectId}/data/${table}?apikey=${encodeURIComponent(apiKey)}&limit=1${params}`;

  console.log(`\n── Test GET /data/${table} ──`);
  const res = await fetch(endpoint);
  const json = await res.json().catch(() => ({}));
  console.log('Status:', res.status, json.message ?? '(ok)');
  if (json.data) console.log('Rows:', Array.isArray(json.data) ? json.data.length : json.data);
  return res.ok;
}

loadEnv();

const renameSql = readFileSync(resolve(__dirname, '../sql/migrate-rename-projects-table.sql'), 'utf8');
const dropLegacyProjectsSql = readFileSync(
  resolve(__dirname, '../sql/migrate-drop-legacy-projects.sql'),
  'utf8',
);
const schemaSql = readFileSync(resolve(__dirname, '../sql/schema.sql'), 'utf8');

// 1. Diagnóstico
await runSql(
  `SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
   ORDER BY table_name;`,
  'Tablas en el schema del proyecto',
);

await runSql(
  `SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'users'
   ORDER BY ordinal_position;`,
  'Columnas de users',
);

await runSql(
  `SELECT EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = 'projects'
   ) AS has_projects,
   EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = 'mailer_projects'
   ) AS has_mailer_projects;`,
  'Conflicto projects / mailer_projects',
);

// 2. Renombrar projects → mailer_projects (si aún no existe mailer_projects)
await runSql(renameSql, 'Migración rename projects');

// 3. Eliminar tabla legacy "projects" (choca con plataforma MatuDB → error p.schema_name)
await runSql(dropLegacyProjectsSql, 'Eliminar projects legacy');

// 4. Re-aplicar schema completo (idempotente)
await runSql(schemaSql, 'Schema completo');

// 5. Verificar de nuevo
await runSql(
  `SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = current_schema()
     AND table_name IN ('users', 'mailer_projects', 'projects')
   ORDER BY table_name;`,
  'Verificación tablas clave',
);

// 6. Probar API de datos (incluye filtro id=eq como el cliente)
await testDataApi('users');
await testDataApi('mailer_projects');
await testDataApi('users', '&id=eq.00000000-0000-0000-0000-000000000000');

console.log('\n✅ Fix completado.');
