import { createMatuOpsClient, type MatuOpsClient } from '@matuops/app-sdk';

let client: MatuOpsClient | null = null;

export function startMatuOps(): MatuOpsClient | null {
  const token = process.env.MATUOPS_APP_TOKEN;
  const endpoint = process.env.MATUOPS_ENDPOINT ?? 'https://ops.matubyte.com';

  if (!token?.startsWith('mapp_')) {
    console.warn('[MatuOps] No configurado — define MATUOPS_APP_TOKEN en .env');
    return null;
  }

  client = createMatuOpsClient({
    token,
    endpoint,
    version: process.env.APP_VERSION ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    captureErrors: false,
    capturePerformance: false,
  });

  client.start();
  client
    .reportLog('MatuMailer API iniciada', 'info', {
      component: 'api',
      port: process.env.PORT ?? '4000',
    })
    .catch(() => undefined);

  return client;
}

export function getMatuOps(): MatuOpsClient | null {
  return client;
}

export function stopMatuOps(): void {
  client?.stop();
  client = null;
}

export async function reportMatuOpsError(
  error: Error | { message: string; stack?: string; source?: string },
  extra?: Record<string, unknown>,
): Promise<void> {
  if (!client) return;
  await client.reportError(error);
  if (extra) {
    await client
      .reportLog(error.message, 'error', { component: 'api', ...extra })
      .catch(() => undefined);
  }
}
