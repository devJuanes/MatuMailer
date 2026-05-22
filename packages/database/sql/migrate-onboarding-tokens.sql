-- Seguimiento de configuración por proyecto (checklist del dashboard)
CREATE TABLE IF NOT EXISTS project_onboarding (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  smtp_completed_at TIMESTAMPTZ,
  test_email_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token recuperable para copiar desde el dashboard (cifrado con ENCRYPTION_KEY)
ALTER TABLE IF EXISTS api_tokens
  ADD COLUMN IF NOT EXISTS token_encrypted TEXT;
