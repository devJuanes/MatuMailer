import { createClient, type MatuDBClient } from '@devjuanes/matuclient';
import { API_URL } from './api';

let client: MatuDBClient | null = null;

/**
 * Devuelve la URL del proxy `/api/matudb` del backend. Esto evita que el
 * navegador contacte directamente a `db.matudb.com` y sufra CORS: el proxy
 * corre server-to-server dentro del propio MatuMailer API.
 */
function proxyUrl(): string {
  // API_URL viene de lib/api.ts y ya tiene los fallbacks seguros aplicados.
  return `${API_URL.replace(/\/$/, '')}/api/matudb`;
}

export function getMatuDb(): MatuDBClient {
  if (client) return client;

  const projectId = process.env.NEXT_PUBLIC_MATUDB_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_MATUDB_API_KEY;

  if (!projectId || !apiKey) {
    throw new Error(
      'Configura NEXT_PUBLIC_MATUDB_PROJECT_ID y NEXT_PUBLIC_MATUDB_API_KEY en apps/dashboard/.env.local',
    );
  }

  client = createClient({
    url: proxyUrl(),
    projectId,
    apiKey,
  });
  return client;
}

export function resetMatuDbClient(): void {
  client = null;
}
