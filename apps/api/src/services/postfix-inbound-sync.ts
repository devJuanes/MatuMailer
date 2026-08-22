/**
 * Best-effort: regenera mapas Postfix tras crear/borrar aliases.
 * Solo corre si POSTFIX_INBOUND_SYNC=1.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let pending: ReturnType<typeof setTimeout> | null = null;

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // apps/api/src/services → repo root
  return resolve(here, '../../../../');
}

export function schedulePostfixInboundSync(reason = 'alias-change'): void {
  if (process.env.POSTFIX_INBOUND_SYNC !== '1') return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    const root = repoRoot();
    const script = resolve(root, 'scripts/sync-postfix-inbound.mjs');
    if (!existsSync(script)) {
      console.warn('[postfix-inbound] script missing:', script);
      return;
    }
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    child.stdout?.on('data', (d) => console.log('[postfix-inbound]', String(d).trim()));
    child.stderr?.on('data', (d) => console.warn('[postfix-inbound]', String(d).trim()));
    child.unref();
    console.log(`[postfix-inbound] sync scheduled (${reason})`);
  }, 1500);
}
