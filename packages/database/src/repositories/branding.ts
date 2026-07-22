import type { ProjectBranding } from '@matumailer/shared';
import { getMatuDb } from '../client';
import { insertOne, updateOne } from '../helpers';

export async function getByProject(projectId: string): Promise<ProjectBranding | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('project_branding')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProjectBranding;
}

export async function upsert(
  projectId: string,
  input: Partial<
    Pick<
      ProjectBranding,
      | 'company_name'
      | 'logo_url'
      | 'primary_color'
      | 'header_html'
      | 'footer_html'
      | 'tracking_enabled'
    >
  >,
): Promise<ProjectBranding> {
  const existing = await getByProject(projectId);
  if (existing) {
    return updateOne<ProjectBranding>(
      'project_branding',
      [{ column: 'project_id', value: projectId }],
      input,
    );
  }
  return insertOne<ProjectBranding>('project_branding', {
    project_id: projectId,
    company_name: input.company_name ?? null,
    logo_url: input.logo_url ?? null,
    primary_color: input.primary_color ?? '#c9a227',
    header_html: input.header_html ?? null,
    footer_html: input.footer_html ?? null,
    tracking_enabled: input.tracking_enabled ?? true,
  });
}
