export class MatuMailerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MatuMailerError';
  }
}

export function parseApiError(body: unknown, status: number): MatuMailerError {
  const err = body as { error?: string; message?: string };
  return new MatuMailerError(
    err.message ?? `Request failed with status ${status}`,
    err.error ?? 'API_ERROR',
    status,
    body,
  );
}
