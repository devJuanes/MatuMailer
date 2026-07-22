import { createClient, type MatuDBClient } from '@devjuanes/matuclient';

let client: MatuDBClient | null = null;

export function getMatuDb(): MatuDBClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_MATUDB_URL;
  const projectId = process.env.NEXT_PUBLIC_MATUDB_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_MATUDB_API_KEY;

  if (!url || !projectId || !apiKey) {
    throw new Error(
      'Configura NEXT_PUBLIC_MATUDB_URL, NEXT_PUBLIC_MATUDB_PROJECT_ID y NEXT_PUBLIC_MATUDB_API_KEY en apps/dashboard/.env.local',
    );
  }

  client = createClient({ url, projectId, apiKey });
  return client;
}

export function resetMatuDbClient(): void {
  client = null;
}
