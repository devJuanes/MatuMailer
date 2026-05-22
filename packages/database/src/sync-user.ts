import type { User } from '@matumailer/shared';
import type { MatuAuthUser } from './matudb-auth';
import { findUserByEmail, findUserById } from './repositories/users';
import { insertOne, updateOne } from './helpers';

/** Sincroniza el usuario de MatuDB Auth con la tabla `users` de la aplicación. */
export async function syncAppUser(
  authUser: MatuAuthUser,
  profile?: { name?: string },
): Promise<User> {
  const name = profile?.name ?? authUser.name ?? authUser.email.split('@')[0];

  const byId = await findUserById(authUser.id);
  if (byId) {
    if (byId.name !== name || byId.email !== authUser.email) {
      return updateOne<User>(
        'users',
        [{ column: 'id', value: authUser.id }],
        { name, email: authUser.email },
      );
    }
    return byId;
  }

  const byEmail = await findUserByEmail(authUser.email);
  if (byEmail) {
    if (byEmail.id !== authUser.id) {
      throw new Error(
        'Este correo ya existe en la aplicación con otro identificador. Elimina el usuario antiguo en MatuDB o contacta soporte.',
      );
    }
    return updateOne<User>(
      'users',
      [{ column: 'id', value: byEmail.id }],
      { name, email: authUser.email },
    );
  }

  try {
    return await insertOne<User>('users', {
      id: authUser.id,
      email: authUser.email,
      name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('password_hash') || msg.includes('null value')) {
      throw new Error(
        'La tabla users aún tiene el schema antiguo. Ejecuta packages/database/sql/migrate-auth-matudb.sql en MatuDB.',
      );
    }
    throw err;
  }
}
