import { getMatuDb } from '../client';

export type DesktopPlatform = 'windows' | 'android';

export interface DesktopAppRelease {
  id: string;
  platform: DesktopPlatform;
  version: string;
  build_number: number;
  title: string | null;
  notes: string | null;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  sha256: string | null;
  download_url: string | null;
  mandatory: boolean;
  is_latest: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export async function findLatestRelease(
  platform: DesktopPlatform,
): Promise<DesktopAppRelease | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('desktop_app_releases')
    .select('*')
    .eq('platform', platform)
    .eq('is_latest', true)
    .order('build_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as DesktopAppRelease | null) ?? null;
}

export async function findReleaseByVersion(
  platform: DesktopPlatform,
  version: string,
  buildNumber?: number,
): Promise<DesktopAppRelease | null> {
  const db = getMatuDb();
  let q = db
    .from('desktop_app_releases')
    .select('*')
    .eq('platform', platform)
    .eq('version', version);

  if (buildNumber != null) q = q.eq('build_number', buildNumber);

  const { data, error } = await q
    .order('build_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as DesktopAppRelease | null) ?? null;
}

export async function listReleases(
  platform?: DesktopPlatform,
  limit = 20,
): Promise<DesktopAppRelease[]> {
  const db = getMatuDb();
  let q = db
    .from('desktop_app_releases')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (platform) q = q.eq('platform', platform);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DesktopAppRelease[];
}

export async function createRelease(input: {
  platform: DesktopPlatform;
  version: string;
  build_number: number;
  title?: string | null;
  notes?: string | null;
  file_name: string;
  file_path: string;
  file_size_bytes?: number | null;
  sha256?: string | null;
  download_url?: string | null;
  mandatory?: boolean;
  is_latest?: boolean;
}): Promise<DesktopAppRelease> {
  const db = getMatuDb();

  if (input.is_latest !== false) {
    // Desmarcar latest anterior de la misma plataforma
    await db
      .from('desktop_app_releases')
      .eq('platform', input.platform)
      .eq('is_latest', true)
      .update({ is_latest: false });
  }

  const { data, error } = await db.from('desktop_app_releases').insert({
    platform: input.platform,
    version: input.version,
    build_number: input.build_number,
    title: input.title ?? null,
    notes: input.notes ?? null,
    file_name: input.file_name,
    file_path: input.file_path,
    file_size_bytes: input.file_size_bytes ?? null,
    sha256: input.sha256 ?? null,
    download_url: input.download_url ?? null,
    mandatory: input.mandatory ?? false,
    is_latest: input.is_latest !== false,
  });

  if (error) throw new Error(error.message);
  const created = (Array.isArray(data) ? data[0] : data) as DesktopAppRelease;
  return created;
}
