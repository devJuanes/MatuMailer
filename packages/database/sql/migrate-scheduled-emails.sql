-- Cola de envíos programados
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  payload JSONB NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  email_log_id UUID REFERENCES email_logs(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_project_id ON scheduled_emails(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(status, scheduled_at)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS scheduled_emails_updated_at ON scheduled_emails;
CREATE TRIGGER scheduled_emails_updated_at BEFORE UPDATE ON scheduled_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
