import { getMatuDb } from '@/lib/matudb';

export interface Template {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  builder_data: unknown;
  variables: string[];
  is_system: boolean;
  project_id?: string;
}

export async function listTemplates(projectId: string): Promise<Template[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('templates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Template[];
}

export async function updateTemplate(
  templateId: string,
  updates: {
    name?: string;
    subject?: string;
    html_content?: string;
    builder_data?: unknown;
    variables?: string[];
    slug?: string;
  },
): Promise<void> {
  const db = getMatuDb();
  const { error } = await db.from('templates').eq('id', templateId).update(updates);
  if (error) throw new Error(error.message);
}

export async function createTemplate(
  projectId: string,
  input: {
    slug: string;
    name: string;
    subject: string;
    html_content: string;
    builder_data?: unknown;
    variables?: string[];
  },
): Promise<Template> {
  const db = getMatuDb();
  const { data, error } = await db.from('templates').insert({
    project_id: projectId,
    slug: input.slug,
    name: input.name,
    subject: input.subject,
    html_content: input.html_content,
    builder_data: input.builder_data ?? null,
    variables: input.variables ?? [],
    is_system: false,
  });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data[0] : data) as Template;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const db = getMatuDb();
  const { error } = await db.from('templates').eq('id', templateId).delete();
  if (error) throw new Error(error.message);
}
