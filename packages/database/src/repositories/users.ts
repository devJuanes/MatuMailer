import type { User } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateOne } from '../helpers';

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('users').select('*').eq('email', email).single();
  if (error || !data) return null;
  return data as User;
}

export async function findUserById(id: string): Promise<User | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('users').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as User;
}

export async function createUser(input: {
  id?: string;
  email: string;
  name: string;
}): Promise<User> {
  return insertOne<User>('users', input);
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<User, 'name' | 'email'>>,
): Promise<User> {
  return updateOne<User>('users', [{ column: 'id', value: id }], updates);
}
