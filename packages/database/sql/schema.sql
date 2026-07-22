  -- MatuMailer PostgreSQL Schema
  -- Run via MatuDB or direct PostgreSQL init

  -- MatuDB no expone uuid-ossp; usar gen_random_uuid() (pgcrypto / PG 13+).
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Users (perfil de app; autenticación gestionada por MatuDB Auth)
  -- El id debe coincidir con el id del usuario en MatuDB Auth
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Projects (mailer_projects — evita choque con tabla platform "projects" de MatuDB)
CREATE TABLE IF NOT EXISTS mailer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_mailer_projects_user_id ON mailer_projects(user_id);

  -- API Tokens
  CREATE TABLE IF NOT EXISTS api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_prefix VARCHAR(20) NOT NULL,
    token_encrypted TEXT,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_api_tokens_project_id ON api_tokens(project_id);
  CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash);

  -- Onboarding / checklist por proyecto
  CREATE TABLE IF NOT EXISTS project_onboarding (
    project_id UUID PRIMARY KEY REFERENCES mailer_projects(id) ON DELETE CASCADE,
    smtp_completed_at TIMESTAMPTZ,
    test_email_sent_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- SMTP Configs
  CREATE TABLE IF NOT EXISTS smtp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES mailer_projects(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL DEFAULT 'custom',
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    secure BOOLEAN NOT NULL DEFAULT FALSE,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(100),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_smtp_configs_project_id ON smtp_configs(project_id);

  -- Templates
  CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
    slug VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    html_content TEXT NOT NULL,
    builder_data JSONB,
    variables JSONB NOT NULL DEFAULT '[]',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, slug)
  );

  CREATE INDEX IF NOT EXISTS idx_templates_project_id ON templates(project_id);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(150),
  metadata JSONB NOT NULL DEFAULT '{}',
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, email)
);
CREATE INDEX IF NOT EXISTS idx_contacts_project_id ON contacts(project_id);

CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_contact_groups_project_id ON contact_groups(project_id);

CREATE TABLE IF NOT EXISTS contact_group_members (
  group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, contact_id)
);

CREATE TABLE IF NOT EXISTS project_branding (
  project_id UUID PRIMARY KEY REFERENCES mailer_projects(id) ON DELETE CASCADE,
  company_name VARCHAR(150),
  logo_url TEXT,
  primary_color VARCHAR(20) NOT NULL DEFAULT '#c9a227',
  header_html TEXT,
  footer_html TEXT,
  tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  template_slug VARCHAR(50),
  group_id UUID REFERENCES contact_groups(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  total_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_project_id ON campaigns(project_id);

  -- Email Logs
  CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    template_slug VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    error_message TEXT,
    user_message TEXT,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    group_id UUID REFERENCES contact_groups(id) ON DELETE SET NULL,
    tracking_token VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_email_logs_project_id ON email_logs(project_id);
  CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id UUID NOT NULL REFERENCES email_logs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_events_log ON email_events(email_log_id);

  -- Scheduled email queue
  CREATE TABLE IF NOT EXISTS scheduled_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    payload JSONB NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    email_log_id UUID REFERENCES email_logs(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_scheduled_emails_project_id ON scheduled_emails(project_id);
  CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(status, scheduled_at)
    WHERE status = 'pending';

  -- Subscriptions (Premium / PayMatuByte)
  CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_reference VARCHAR(100) UNIQUE,
    amount INTEGER,
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    link_id VARCHAR(100),
    transaction_id VARCHAR(100),
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_reference ON subscriptions(payment_reference);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

  -- Pending signups (registro Premium + PayMatuByte)
  CREATE TABLE IF NOT EXISTS pending_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    payment_reference TEXT NOT NULL UNIQUE,
    link_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    user_id UUID,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
  CREATE INDEX IF NOT EXISTS idx_pending_signups_ref ON pending_signups(payment_reference);

  -- Updated_at trigger
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS users_updated_at ON users;
  CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS mailer_projects_updated_at ON mailer_projects;
CREATE TRIGGER mailer_projects_updated_at BEFORE UPDATE ON mailer_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS smtp_configs_updated_at ON smtp_configs;
  CREATE TRIGGER smtp_configs_updated_at BEFORE UPDATE ON smtp_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS templates_updated_at ON templates;
  CREATE TRIGGER templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS scheduled_emails_updated_at ON scheduled_emails;
  CREATE TRIGGER scheduled_emails_updated_at BEFORE UPDATE ON scheduled_emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
  CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
