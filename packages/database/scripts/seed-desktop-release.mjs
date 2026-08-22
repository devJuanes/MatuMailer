/**
 * Inserta / actualiza el release Windows 1.0.0 en desktop_app_releases.
 * Uso (en el VPS, con .env): node packages/database/scripts/seed-desktop-release.mjs
 *
 * Env opcionales:
 *   RELEASE_VERSION=1.0.0
 *   RELEASE_BUILD=1
 *   RELEASE_FILE=windows/MatuMail-Windows-1.0.0.zip
 *   RELEASE_FILE_NAME=MatuMail-Windows-1.0.0.zip
 *   RELEASE_SIZE=16722215
 *   RELEASE_SHA256=...
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

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
if (!url || !projectId || !apiKey) {
  console.error('Faltan MATUDB_URL / MATUDB_PROJECT_ID / MATUDB_API_KEY');
  process.exit(1);
}

const version = process.env.RELEASE_VERSION || '1.0.0';
const build = Number(process.env.RELEASE_BUILD || 1);
const filePath = process.env.RELEASE_FILE || 'windows/MatuMail-Windows-1.0.0.zip';
const fileName =
  process.env.RELEASE_FILE_NAME || 'MatuMail-Windows-1.0.0.zip';
const downloadUrl =
  process.env.RELEASE_DOWNLOAD_URL ||
  'https://matumailer.matubyte.com/api/desktop/download/windows/latest';

const localFile = join(
  process.env.DESKTOP_RELEASES_DIR || join(root, 'releases'),
  filePath,
);

let fileSize = process.env.RELEASE_SIZE
  ? Number(process.env.RELEASE_SIZE)
  : null;
let sha256 = process.env.RELEASE_SHA256 || null;

if (existsSync(localFile)) {
  const buf = readFileSync(localFile);
  fileSize = buf.length;
  sha256 = createHash('sha256').update(buf).digest('hex');
  console.log(`Archivo local: ${localFile} (${fileSize} bytes)`);
} else if (fileSize == null) {
  console.warn(`Aviso: no existe ${localFile}; insertando sin size/sha.`);
}

async function runSql(query) {
  const res = await fetch(`${url}/api/projects/${projectId}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ query }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message ?? JSON.stringify(json));
  }
  return json;
}

await runSql(`
  UPDATE desktop_app_releases
  SET is_latest = FALSE, updated_at = NOW()
  WHERE platform = 'windows' AND is_latest = TRUE
`);

await runSql(`
  INSERT INTO desktop_app_releases (
    platform, version, build_number, title, notes,
    file_name, file_path, file_size_bytes, sha256,
    download_url, mandatory, is_latest
  ) VALUES (
    'windows',
    '${version}',
    ${build},
    'Matu Mail ${version}',
    'Cliente Windows Matu Mail. Descomprime el ZIP y ejecuta matumail.exe.',
    '${fileName}',
    '${filePath}',
    ${fileSize == null ? 'NULL' : fileSize},
    ${sha256 ? `'${sha256}'` : 'NULL'},
    '${downloadUrl}',
    FALSE,
    TRUE
  )
  ON CONFLICT (platform, version, build_number) DO UPDATE SET
    title = EXCLUDED.title,
    notes = EXCLUDED.notes,
    file_name = EXCLUDED.file_name,
    file_path = EXCLUDED.file_path,
    file_size_bytes = EXCLUDED.file_size_bytes,
    sha256 = EXCLUDED.sha256,
    download_url = EXCLUDED.download_url,
    is_latest = TRUE,
    updated_at = NOW()
`);

console.log(`✅ Release windows ${version}+${build} publicado.`);
