import { getMatuDb } from './client';

/** Normalize string[] for PostgreSQL JSONB columns via MatuDB. */
export function toJsonb(value: string[] | Record<string, unknown> | unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export async function insertOne<T>(table: string, input: Partial<T>): Promise<T> {
  const db = getMatuDb();
  const { data, error } = await db.from(table).select_returning('representation').insert(input);
  if (error || !data?.[0]) {
    throw new Error(error?.message ?? `Failed to insert into ${table}`);
  }
  return data[0] as T;
}

export async function insertMany<T>(table: string, rows: Partial<T>[]): Promise<T[]> {
  const db = getMatuDb();
  const { data, error } = await db.from(table).select_returning('representation').insert(rows);
  if (error || !data) {
    throw new Error(error?.message ?? `Failed to insert into ${table}`);
  }
  return data as T[];
}

export async function updateOne<T>(
  table: string,
  filters: { column: string; value: unknown }[],
  updates: Partial<T>,
): Promise<T> {
  const db = getMatuDb();
  let query = db.from(table).select_returning('representation');
  for (const f of filters) {
    query = query.eq(f.column, f.value);
  }
  const { data, error } = await query.update(updates);
  if (error || !data?.[0]) {
    throw new Error(error?.message ?? `Failed to update ${table}`);
  }
  return data[0] as T;
}

export async function updateMany(
  table: string,
  filters: { column: string; value: unknown }[],
  updates: Record<string, unknown>,
): Promise<void> {
  const db = getMatuDb();
  let query = db.from(table);
  for (const f of filters) {
    query = query.eq(f.column, f.value);
  }
  const { error } = await query.update(updates);
  if (error) throw new Error(error.message);
}
