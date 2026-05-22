import { createClient, type MatuDBClient } from '@devjuanes/matuclient';
import { loadMonorepoEnv } from './load-env';

loadMonorepoEnv();

export interface MatuDbConfig {
  url?: string;
  projectId?: string;
  apiKey?: string;
}

let clientInstance: MatuDBClient | null = null;

export function getMatuDb(config?: MatuDbConfig): MatuDBClient {
  if (clientInstance && !config) return clientInstance;

  const url = config?.url ?? process.env.MATUDB_URL ?? 'http://localhost:3001';
  const projectId = config?.projectId ?? process.env.MATUDB_PROJECT_ID ?? 'matumailer';
  const apiKey = config?.apiKey ?? process.env.MATUDB_API_KEY;

  if (!apiKey) {
    throw new Error(
      'MATUDB_API_KEY is required. Set it in your environment or pass apiKey to getMatuDb().',
    );
  }

  clientInstance = createClient({ url, projectId, apiKey });
  return clientInstance;
}

export function resetMatuDbClient(): void {
  clientInstance = null;
}

export type { MatuDBClient };
