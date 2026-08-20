import { getMatuDb } from '@/lib/matudb';
import { getCurrentUserId } from '@/lib/auth-matudb';
import { SYSTEM_TEMPLATES } from '@/lib/system-templates';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  default_domain_id?: string | null;
  user_id?: string;
}

export async function listProjects(): Promise<Project[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const db = getMatuDb();
  const { data, error } = await db
    .from('mailer_projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export async function createProject(input: {
  name: string;
  slug: string;
  description?: string | null;
}): Promise<Project> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const db = getMatuDb();

  const { data: existing, error: existingErr } = await db
    .from('mailer_projects')
    .select('id')
    .eq('user_id', userId)
    .eq('slug', input.slug)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing) throw new Error('Ya existe un proyecto con ese slug');

  const { data: project, error } = await db.from('mailer_projects').insert({
    user_id: userId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
  });
  if (error) throw new Error(error.message);

  const created = (Array.isArray(project) ? project[0] : project) as Project;

  for (const tpl of SYSTEM_TEMPLATES) {
    const { error: tplErr } = await db.from('templates').insert({
      project_id: created.id,
      slug: tpl.slug,
      name: tpl.name,
      subject: tpl.subject,
      html_content: tpl.html_content,
      builder_data: null,
      // MatuDB exige JSONB como string JSON
      variables: JSON.stringify(tpl.variables),
      is_system: true,
    });
    if (tplErr) throw new Error(tplErr.message);
  }

  return created;
}

export async function deleteProject(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('No autenticado');

  const db = getMatuDb();
  const { data: project, error: findErr } = await db
    .from('mailer_projects')
    .select('user_id')
    .eq('id', id)
    .single();
  if (findErr || !project) throw new Error('Proyecto no encontrado');
  if (project.user_id !== userId) throw new Error('No autorizado');

  const { error } = await db.from('mailer_projects').eq('id', id).delete();
  if (error) throw new Error(error.message);
}
