const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('matumailer_token');
}

export function setToken(token: string) {
  localStorage.setItem('matumailer_token', token);
}

export function clearToken() {
  localStorage.removeItem('matumailer_token');
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const token = options.token ?? getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };
  const hasBody = options.body != null && options.body !== '';
  if (hasBody && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data as { message?: string; error?: string };
    throw new Error(err.message ?? err.error ?? `Error ${res.status}`);
  }
  return data as T;
}
