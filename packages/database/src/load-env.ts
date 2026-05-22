import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Carga .env desde la raíz del monorepo sin dotenv (compatible con ESM).
 */
export function loadMonorepoEnv(): string | undefined {
  let dir = process.cwd();

  for (let i = 0; i < 8; i++) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath)) {
      applyEnvFile(readFileSync(envPath, 'utf8'));
      return envPath;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  return undefined;
}

function applyEnvFile(content: string): void {
  for (const line of content.split('\n')) {
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

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
