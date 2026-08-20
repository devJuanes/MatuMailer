import { getEmailStats } from '@/lib/db/email-logs';
import { listApiTokens } from '@/lib/db/api-tokens';
import { listTemplates } from '@/lib/db/templates';
import { listDomains } from '@/lib/db/domains';

/**
 * Estado del setup del proyecto para el checklist del dashboard.
 *
 * Antes incluía `smtpConfigured`. Como el SMTP propio ya no se usa (todo va
 * por el relay MatuMailer + DKIM por dominio verificado), ahora el primer
 * paso es `hasVerifiedDomain`.
 */
export interface SetupStatus {
  hasVerifiedDomain: boolean;
  welcomeTemplate: boolean;
  hasApiToken: boolean;
  testEmailSent: boolean;
  completedCount: number;
  totalSteps: number;
}

const TOTAL_STEPS = 4;

export async function getProjectSetupStatus(projectId: string): Promise<SetupStatus> {
  const [domains, templates, stats, tokens] = await Promise.all([
    listDomains(projectId),
    listTemplates(projectId),
    getEmailStats(projectId),
    listApiTokens(projectId),
  ]);

  const hasVerifiedDomain = domains.some((d) => d.status === 'verified');
  const welcomeTemplate = templates.some((t) => t.slug === 'welcome');
  const hasApiToken = tokens.length > 0;
  const testEmailSent = stats.sent > 0;

  const flags = [hasVerifiedDomain, welcomeTemplate, hasApiToken, testEmailSent];
  return {
    hasVerifiedDomain,
    welcomeTemplate,
    hasApiToken,
    testEmailSent,
    completedCount: flags.filter(Boolean).length,
    totalSteps: TOTAL_STEPS,
  };
}
