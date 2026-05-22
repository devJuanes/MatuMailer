import type { Session } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne } from '../helpers';

export async function createSession(input: {
  user_id: string;
  token_hash: string;
  expires_at: string;
}): Promise<Session> {
  return insertOne<Session>('sessions', input);
}

export async function findSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .single();
  if (error || !data) return null;
  return data as Session;
}

export async function deleteSession(id: string): Promise<void> {
  const db = getMatuDb();
  await db.from('sessions').eq('id', id).delete();
}

export async function deleteSessionsByUserId(userId: string): Promise<void> {
  const db = getMatuDb();
  await db.from('sessions').eq('user_id', userId).delete();
}
