export interface MatuAuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  is_active?: boolean;
  email_verified?: boolean;
  created_at?: string;
}

export class MatuAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'MatuAuthError';
  }
}

function authBaseUrl(): string {
  const url = (process.env.MATUDB_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  const projectId = process.env.MATUDB_PROJECT_ID ?? 'matumailer';
  return `${url}/api/projects/${projectId}/auth`;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const apiKey = process.env.MATUDB_API_KEY;
  if (!apiKey) throw new MatuAuthError('MATUDB_API_KEY no está configurada', 500);
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
    ...extra,
  };
}

async function parseAuthResponse(res: Response): Promise<{
  user: MatuAuthUser;
  token: string;
}> {
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    error?: string;
    data?: { user?: MatuAuthUser; token?: string };
    user?: MatuAuthUser;
    token?: string;
  };

  if (!res.ok) {
    const nested = json.error as { message?: string; details?: Record<string, string[]> } | string | undefined;
    let detailMsg = '';
    if (nested && typeof nested === 'object' && nested.details) {
      detailMsg = Object.entries(nested.details)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('; ');
    }
    let base = `Error de autenticación en MatuDB (${res.status})`;
    if (json.message) {
      base = json.message;
    } else if (typeof nested === 'string') {
      base = nested;
    } else if (nested && typeof nested === 'object' && nested.message) {
      base = nested.message;
    }
    throw new MatuAuthError(detailMsg ? `${base} — ${detailMsg}` : base, res.status);
  }

  const user = json.data?.user ?? json.user;
  const token = json.data?.token ?? json.token;

  if (!user?.id || !token) {
    throw new MatuAuthError(
      `Respuesta inválida de MatuDB Auth: ${JSON.stringify(json).slice(0, 200)}`,
      502,
    );
  }

  return { user, token };
}

/** Registro en MatuDB Auth (verificación de correo gestionada por MatuDB). */
export async function matuSignUp(
  email: string,
  password: string,
  name: string,
): Promise<{ user: MatuAuthUser; token: string }> {
  const res = await fetch(`${authBaseUrl()}/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password, name }),
  });
  return parseAuthResponse(res);
}

/** Inicio de sesión en MatuDB Auth. */
export async function matuSignIn(
  email: string,
  password: string,
): Promise<{ user: MatuAuthUser; token: string }> {
  const res = await fetch(`${authBaseUrl()}/login`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  return parseAuthResponse(res);
}

/** Valida el JWT de MatuDB y devuelve el usuario autenticado. */
export async function matuGetUserFromToken(token: string): Promise<MatuAuthUser> {
  const res = await fetch(`${authBaseUrl()}/user`, {
    headers: authHeaders({ Authorization: `Bearer ${token}` }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    data?: MatuAuthUser | { user?: MatuAuthUser };
  };

  if (!res.ok) {
    throw new MatuAuthError(json.message ?? 'Token inválido o expirado', 401);
  }

  const user =
    (json.data as { user?: MatuAuthUser })?.user ??
    (json.data as MatuAuthUser | undefined);

  if (!user?.id) {
    throw new MatuAuthError('No se pudo obtener el usuario autenticado', 401);
  }

  return user;
}

/** Solicitar recuperación de contraseña (MatuDB envía el correo). */
export async function matuRecoverPassword(email: string): Promise<void> {
  const res = await fetch(`${authBaseUrl()}/recover`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    throw new MatuAuthError(json.message ?? 'Error al solicitar recuperación de contraseña', res.status);
  }
}
