import { getMatuDb } from '@/lib/matudb';
import { setToken, clearToken } from '@/lib/api';

const LEGACY_TOKEN_KEY = 'matumailer_token';

/** Sincroniza el usuario de MatuDB Auth con la tabla `users` de la app. */
export async function syncAppUser(
  authUser: { id: string; email: string; name?: string | null },
  profile?: { name?: string },
): Promise<void> {
  const db = getMatuDb();
  const name = profile?.name ?? authUser.name ?? authUser.email.split('@')[0];

  const { data: byId, error: byIdErr } = await db
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();
  if (byIdErr) throw new Error(byIdErr.message);
  if (byId) {
    if (byId.name !== name || byId.email !== authUser.email) {
      const { error } = await db
        .from('users')
        .eq('id', authUser.id)
        .update({ name, email: authUser.email });
      if (error) throw new Error(error.message);
    }
    return;
  }

  const { data: byEmail, error: byEmailErr } = await db
    .from('users')
    .select('*')
    .eq('email', authUser.email)
    .maybeSingle();
  if (byEmailErr) throw new Error(byEmailErr.message);
  if (byEmail && byEmail.id !== authUser.id) {
    throw new Error(
      'Este correo ya existe en la aplicación con otro identificador. Contacta soporte.',
    );
  }

  const { error } = await db.from('users').insert({ id: authUser.id, email: authUser.email, name });
  if (error) throw new Error(error.message);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const db = getMatuDb();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session?.access_token || !data.user) {
    throw new Error('Respuesta de autenticación inválida');
  }
  await syncAppUser(data.user);
  setToken(data.session.access_token);
}

export async function signUp(email: string, password: string, name: string): Promise<void> {
  const db = getMatuDb();
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(error.message);
  if (!data.session?.access_token || !data.user) {
    throw new Error(
      'Cuenta creada. Revisa tu correo si MatuDB requiere verificación antes de iniciar sesión.',
    );
  }
  await syncAppUser(data.user, { name });
  setToken(data.session.access_token);
}

export async function signOut(): Promise<void> {
  const db = getMatuDb();
  await db.auth.signOut();
  clearToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const db = getMatuDb();
  const { data } = await db.auth.getUser();
  return data.user?.id ?? null;
}
