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

/** MatuDB exige columnas JSONB como string JSON válido. */
function toJsonb(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function normalizeTemplate(row: Record<string, unknown>): Template {
  const variables = row.variables;
  let parsedVars: string[] = [];
  if (Array.isArray(variables)) {
    parsedVars = variables.map(String);
  } else if (typeof variables === 'string') {
    try {
      const v = JSON.parse(variables);
      parsedVars = Array.isArray(v) ? v.map(String) : [];
    } catch {
      parsedVars = [];
    }
  }

  let builderData = row.builder_data ?? null;
  if (typeof builderData === 'string') {
    try {
      builderData = JSON.parse(builderData);
    } catch {
      builderData = null;
    }
  }

  return {
    ...(row as unknown as Template),
    variables: parsedVars,
    builder_data: builderData,
  };
}

export async function listTemplates(projectId: string): Promise<Template[]> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('templates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => normalizeTemplate(row));
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
  const row: Record<string, unknown> = { ...updates };
  if (updates.variables !== undefined) row.variables = toJsonb(updates.variables);
  if (updates.builder_data !== undefined) {
    row.builder_data = updates.builder_data === null ? null : toJsonb(updates.builder_data);
  }
  const { error } = await db.from('templates').eq('id', templateId).update(row);
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
    builder_data:
      input.builder_data === undefined || input.builder_data === null
        ? null
        : toJsonb(input.builder_data),
    variables: toJsonb(input.variables ?? []),
    is_system: false,
  });
  if (error) throw new Error(error.message);
  const raw = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return normalizeTemplate(raw);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const db = getMatuDb();
  const { error } = await db.from('templates').eq('id', templateId).delete();
  if (error) throw new Error(error.message);
}
