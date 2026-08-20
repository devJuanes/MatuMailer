-- MatuMailer: bandeja de entrada (inbound)
CREATE TABLE IF NOT EXISTS inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES mailer_domains(id) ON DELETE SET NULL,
  alias_id UUID REFERENCES mailer_domain_aliases(id) ON DELETE SET NULL,
  message_id VARCHAR(255),
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL DEFAULT '',
  preview TEXT,
  text_body TEXT,
  html_body TEXT,
  folder VARCHAR(40) NOT NULL DEFAULT 'inbox',
  category VARCHAR(40) NOT NULL DEFAULT 'primary',
  starred BOOLEAN NOT NULL DEFAULT FALSE,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  unread BOOLEAN NOT NULL DEFAULT TRUE,
  has_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  raw_headers JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_project_folder
  ON inbound_messages(project_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_to_email
  ON inbound_messages(to_email);
CREATE INDEX IF NOT EXISTS idx_inbound_alias
  ON inbound_messages(alias_id);

DROP TRIGGER IF EXISTS inbound_messages_updated_at ON inbound_messages;
CREATE TRIGGER inbound_messages_updated_at
  BEFORE UPDATE ON inbound_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
