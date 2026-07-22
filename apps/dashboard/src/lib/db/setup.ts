import { getMatuDb } from '@/lib/matudb';
import { getEmailStats } from '@/lib/db/email-logs';
import { listApiTokens } from '@/lib/db/api-tokens';
import { listTemplates } from '@/lib/db/templates';

export interface SetupStatus {
  smtpConfigured: boolean;
  welcomeTemplate: boolean;
  hasApiToken: boolean;
  testEmailSent: boolean;
  completedCount: number;
  totalSteps: number;
}

const TOTAL_STEPS = 4;

export async function getProjectSetupStatus(projectId: string): Promise<SetupStatus> {
  const db = getMatuDb();

  const [smtpRes, onboardingRes, templates, tokens, stats] = await Promise.all([
    db.from('smtp_configs').select('id').eq('project_id', projectId).maybeSingle(),
    db.from('project_onboarding').select('*').eq('project_id', projectId).maybeSingle(),
    listTemplates(projectId),
    listApiTokens(projectId),
    getEmailStats(projectId),
  ]);

  const smtpConfigured =
    !!smtpRes.data ||
    !!(onboardingRes.data as { smtp_completed_at?: string } | null)?.smtp_completed_at;
  const welcomeTemplate = templates.some((t) => t.slug === 'welcome');
  const hasApiToken = tokens.length > 0;
  const onboarding = onboardingRes.data as { test_email_sent_at?: string } | null;
  const testEmailSent = !!onboarding?.test_email_sent_at || stats.sent > 0;

  const flags = [smtpConfigured, welcomeTemplate, hasApiToken, testEmailSent];
  return {
    smtpConfigured,
    welcomeTemplate,
    hasApiToken,
    testEmailSent,
    completedCount: flags.filter(Boolean).length,
    totalSteps: TOTAL_STEPS,
  };
}

export async function getSmtpConfigPublic(projectId: string): Promise<{
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_email: string;
  from_name: string;
  is_verified: boolean;
} | null> {
  const db = getMatuDb();
  const { data, error } = await db
    .from('smtp_configs')
    .select('provider, host, port, secure, username, from_email, from_name, is_verified')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    provider: string;
    host: string;
    port: number;
    secure: boolean;
    username: string;
    from_email: string;
    from_name: string;
    is_verified: boolean;
  } | null;
}
