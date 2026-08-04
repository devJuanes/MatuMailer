#!/usr/bin/env node
/**
 * Copia MATUDB_* y NEXT_PUBLIC_* del .env raíz a apps/dashboard/.env.local (dev)
 * y apps/dashboard/.env.production (build).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const dashboardDir = join(root, 'apps', 'dashboard');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function pick(env, keys) {
  const out = {};
  for (const key of keys) {
    if (env[key]) out[key] = env[key];
  }
  return out;
}

if (!existsSync(envPath)) {
  console.error('ERROR: falta .env en la raíz de MatuSendMail');
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, 'utf8'));

const matudbUrl = env.NEXT_PUBLIC_MATUDB_URL || env.MATUDB_URL;
const matudbProjectId = env.NEXT_PUBLIC_MATUDB_PROJECT_ID || env.MATUDB_PROJECT_ID;
const matudbApiKey = env.NEXT_PUBLIC_MATUDB_API_KEY || env.MATUDB_API_KEY;

if (!matudbUrl || !matudbProjectId || !matudbApiKey) {
  console.error(
    'ERROR: define MATUDB_URL, MATUDB_PROJECT_ID y MATUDB_API_KEY en .env (o sus NEXT_PUBLIC_*).',
  );
  process.exit(1);
}

const publicKeys = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_CONTACT_EMAIL',
  'NEXT_PUBLIC_CONTACT_PHONE',
  'NEXT_PUBLIC_CONTACT_WHATSAPP',
  'NEXT_PUBLIC_CONTACT_WHATSAPP_MSG',
];

const merged = {
  ...pick(env, publicKeys),
  NEXT_PUBLIC_MATUDB_URL: matudbUrl,
  NEXT_PUBLIC_MATUDB_PROJECT_ID: matudbProjectId,
  NEXT_PUBLIC_MATUDB_API_KEY: matudbApiKey,
};

const defaults = {
  NEXT_PUBLIC_API_URL: 'http://localhost:4001',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_CONTACT_EMAIL: 'contacto@matubyte.com',
  NEXT_PUBLIC_CONTACT_PHONE: '+57 333 277 1764',
  NEXT_PUBLIC_CONTACT_WHATSAPP: '573332771764',
  NEXT_PUBLIC_CONTACT_WHATSAPP_MSG: 'Hola, me interesa conocer más sobre MatuMailer.',
};

for (const [key, value] of Object.entries(defaults)) {
  if (!merged[key]) merged[key] = value;
}

function formatEnv(vars) {
  return (
    Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n'
  );
}

const localPath = join(dashboardDir, '.env.local');
const productionPath = join(dashboardDir, '.env.production');

const localVars = { ...merged };
writeFileSync(localPath, formatEnv(localVars), 'utf8');

const prodVars = {
  ...merged,
  NEXT_PUBLIC_API_URL: env.APP_URL?.startsWith('https://')
    ? env.APP_URL
    : 'https://matumailer.matubyte.com',
  NEXT_PUBLIC_APP_URL: env.APP_URL?.startsWith('https://')
    ? env.APP_URL
    : 'https://matumailer.matubyte.com',
};
writeFileSync(productionPath, formatEnv(prodVars), 'utf8');

console.log(`✓ ${localPath}`);
console.log(`✓ ${productionPath}`);
console.log(`  MatuDB project: ${matudbProjectId}`);
