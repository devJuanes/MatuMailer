const FALLBACK_PROD_API_URL = 'https://api.matucatalogo.com';

function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const isBrowser = typeof window !== 'undefined';

  if (!raw) {
    if (!isBrowser && process.env.NODE_ENV === 'production') {
      console.warn('[matumailer] NEXT_PUBLIC_API_URL no definida — usando default de producción.');
    }
    return isBrowser && process.env.NODE_ENV === 'production'
      ? FALLBACK_PROD_API_URL
      : 'http://localhost:4001';
  }

  // Evita que el dashboard termine apuntándose a sí mismo (bug clásico).
  if (isBrowser && raw.includes(window.location.host) && raw !== FALLBACK_PROD_API_URL) {
    console.error(
      `[matumailer] NEXT_PUBLIC_API_URL="${raw}" apunta al propio dashboard. ` +
        `Corrígelo a "${FALLBACK_PROD_API_URL}" antes de hacer build de producción.`,
    );
    return FALLBACK_PROD_API_URL;
  }

  return raw;
}

const API_URL = resolveApiBase();

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const legacy = localStorage.getItem('matumailer_token');
  if (legacy) return legacy;
  try {
    const raw = localStorage.getItem('matudb_session');
    if (!raw) return null;
    const session = JSON.parse(raw) as { access_token?: string };
    return session.access_token ?? null;
  } catch {
    return null;
  }
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
