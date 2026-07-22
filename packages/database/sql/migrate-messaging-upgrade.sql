-- MatuMailer messaging upgrade: contacts, groups, branding, campaigns, tracking
-- Idempotent — safe to re-run

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

-- Groups
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
CREATE INDEX IF NOT EXISTS idx_contact_group_members_contact ON contact_group_members(contact_id);

-- Project branding kit
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

-- Campaigns (bulk / group / scheduled)
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
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Email logs extensions
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS user_message TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES contact_groups(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_tracking_token
  ON email_logs(tracking_token) WHERE tracking_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_id ON email_logs(campaign_id);

-- Scheduled emails: link to campaign
ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_campaign_id ON scheduled_emails(campaign_id);

-- Tracking events
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
CREATE INDEX IF NOT EXISTS idx_email_events_project ON email_events(project_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(type);

-- Triggers
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS contact_groups_updated_at ON contact_groups;
CREATE TRIGGER contact_groups_updated_at BEFORE UPDATE ON contact_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS project_branding_updated_at ON project_branding;
CREATE TRIGGER project_branding_updated_at BEFORE UPDATE ON project_branding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
