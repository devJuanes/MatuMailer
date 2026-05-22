import type { Project } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne } from '../helpers';

export async function findProjectsByUserId(userId: string): Promise<Project[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export async function findProjectById(id: string): Promise<Project | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('projects').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Project;
}

export async function findProjectBySlug(userId: string, slug: string): Promise<Project | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data as Project;
}

export async function createProject(input: {
  user_id: string;
  name: string;
  slug: string;
  description?: string | null;
}): Promise<Project> {
  return insertOne<Project>('projects', input);
}

export async function deleteProject(id: string): Promise<void> {
  const db = getMatuDb();
  await db.from('projects').eq('id', id).delete();
}
