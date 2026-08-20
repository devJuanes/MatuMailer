import type { ProjectSetupStatus } from '@matumailer/shared';
import {
  aliasesRepo,
  apiTokensRepo,
  domainsRepo,
  emailLogsRepo,
  onboardingRepo,
  templatesRepo,
} from '@matumailer/database';

const TOTAL_STEPS = 4;

export async function getProjectSetupStatus(projectId: string): Promise<ProjectSetupStatus> {
  const [domains, aliases, tokens, templates, onboarding, stats] = await Promise.all([
    domainsRepo.listDomainsByProject(projectId),
    aliasesRepo.listSendableAliases(projectId),
    apiTokensRepo.findTokensByProjectId(projectId),
    templatesRepo.findTemplatesByProjectId(projectId),
    onboardingRepo.findOnboardingByProjectId(projectId),
    emailLogsRepo.getEmailStats(projectId),
  ]);

  const hasVerifiedDomain =
    domains.some((d) => d.status === 'verified') && aliases.length > 0;
  const welcomeTemplate = templates.some((t) => t.slug === 'welcome');
  const hasApiToken = tokens.length > 0;
  const testEmailSent = !!onboarding?.test_email_sent_at || stats.sent > 0;

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
