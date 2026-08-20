-- MatuMailer: identidad de envío por proyecto + logs enriquecidos.
-- Quita la dependencia de SMTP del usuario (smtp_configs).

ALTER TABLE mailer_projects
  ADD COLUMN IF NOT EXISTS default_alias_id UUID REFERENCES mailer_domain_aliases(id) ON DELETE SET NULL;

ALTER TABLE api_tokens
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[];

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS alias_id UUID REFERENCES mailer_domain_aliases(id) ON DELETE SET NULL;

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS from_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES mailer_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alias_id UUID REFERENCES mailer_domain_aliases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(40),
  ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);

-- Onboarding ya no usa SMTP del cliente.
ALTER TABLE project_onboarding
  DROP COLUMN IF EXISTS smtp_completed_at;

DROP TRIGGER IF EXISTS smtp_configs_updated_at ON smtp_configs;
DROP TABLE IF EXISTS smtp_configs;
