import type { Template, TemplateBlock } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, toJsonb, updateOne } from '../helpers';

function serializeTemplateRow(
  input: Partial<Omit<Template, 'id' | 'created_at' | 'updated_at'>>,
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...input };
  if (input.variables) row.variables = toJsonb(input.variables);
  if (input.builder_data !== undefined) {
    row.builder_data =
      input.builder_data === null ? null : toJsonb(input.builder_data as TemplateBlock[]);
  }
  return row;
}

export async function findTemplatesByProjectId(projectId: string): Promise<Template[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('templates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Template[];
}

export async function findTemplateBySlug(
  projectId: string,
  slug: string,
): Promise<Template | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('templates')
    .select('*')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data as Template;
}

export async function findTemplateById(id: string): Promise<Template | null> {
  const db = getMatuDb();
  const { data, error } = await db.from('templates').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Template;
}

export async function createTemplate(
  input: Omit<Template, 'id' | 'created_at' | 'updated_at'>,
): Promise<Template> {
  return insertOne<Template>('templates', serializeTemplateRow(input) as Omit<Template, 'id' | 'created_at' | 'updated_at'>);
}

export async function updateTemplate(
  id: string,
  updates: Partial<
    Pick<Template, 'name' | 'subject' | 'html_content' | 'variables' | 'builder_data' | 'slug'>
  >,
): Promise<Template> {
  return updateOne<Template>(
    'templates',
    [{ column: 'id', value: id }],
    serializeTemplateRow(updates) as Partial<Template>,
  );
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = getMatuDb();
  await db.from('templates').eq('id', id).delete();
}
