import type { ProjectSetupStatus } from '@matumailer/shared';
import {
  apiTokensRepo,
  emailLogsRepo,
  onboardingRepo,
  smtpConfigsRepo,
  templatesRepo,
} from '@matumailer/database';

const TOTAL_STEPS = 4;

export async function getProjectSetupStatus(projectId: string): Promise<ProjectSetupStatus> {
  const [smtp, tokens, templates, onboarding, stats] = await Promise.all([
    smtpConfigsRepo.findSmtpByProjectId(projectId),
    apiTokensRepo.findTokensByProjectId(projectId),
    templatesRepo.findTemplatesByProjectId(projectId),
    onboardingRepo.findOnboardingByProjectId(projectId),
    emailLogsRepo.getEmailStats(projectId),
  ]);

  const smtpConfigured = !!smtp || !!onboarding?.smtp_completed_at;
  const welcomeTemplate = templates.some((t) => t.slug === 'welcome');
  const hasApiToken = tokens.length > 0;
  const testEmailSent =
    !!onboarding?.test_email_sent_at || stats.sent > 0;

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
