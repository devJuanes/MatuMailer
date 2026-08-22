#!/usr/bin/env node
/**
 * Otorga Premium a un usuario (suscripción activa).
 * Uso: node packages/database/scripts/grant-premium.mjs <userId> [meses]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@devjuanes/matuclient';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const envPath = join(root, '.env');

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(envPath);

const userId = process.argv[2];
const months = Number(process.argv[3] || 12);
if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
  console.error('Uso: node packages/database/scripts/grant-premium.mjs <userId> [meses]');
  process.exit(1);
}

const url = process.env.MATUDB_URL;
const projectId = process.env.MATUDB_PROJECT_ID;
const apiKey = process.env.MATUDB_API_KEY;
if (!url || !projectId || !apiKey) {
  console.error('Faltan MATUDB_* en .env');
  process.exit(1);
}

const db = createClient({ url, projectId, apiKey });

const now = new Date();
const expires = new Date(now);
expires.setMonth(expires.getMonth() + months);
const reference = `manual-premium-${userId.slice(0, 8)}-${Date.now()}`;

// Expirar otras activas
const { data: active } = await db
  .from('subscriptions')
  .select('id')
  .eq('user_id', userId)
  .eq('status', 'active');

for (const row of active ?? []) {
  await db
    .from('subscriptions')
    .eq('id', row.id)
    .update({ status: 'expired', updated_at: now.toISOString() });
}

const { data, error } = await db.from('subscriptions').insert({
  user_id: userId,
  plan_id: months >= 12 ? 'plan-anual' : months >= 6 ? 'plan-semestral' : 'plan-mensual',
  status: 'active',
  payment_reference: reference,
  amount: 0,
  currency: 'COP',
  link_id: null,
  transaction_id: 'manual-grant',
  starts_at: now.toISOString(),
  expires_at: expires.toISOString(),
  paid_at: now.toISOString(),
});

if (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}

const row = Array.isArray(data) ? data[0] : data;
console.log('✓ Premium activado');
console.log('  user_id:', userId);
console.log('  subscription:', row?.id ?? '(ok)');
console.log('  hasta:', expires.toISOString());
console.log('  reference:', reference);
