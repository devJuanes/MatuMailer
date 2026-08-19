-- MatuMailer: Custom sending domains (Resend-style)
-- Permite añadir un dominio (ej. destin.com), generar DKIM,
-- verificar DNS (SPF/DKIM/DMARC/MX/return-path) y enviar desde
-- cualquier sub-cuenta del dominio verificado.

CREATE TABLE IF NOT EXISTS mailer_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES mailer_projects(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  region VARCHAR(20) NOT NULL DEFAULT 'us-east-1',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  dkim_selector VARCHAR(40) NOT NULL,
  dkim_public_key TEXT NOT NULL,
  dkim_private_key_encrypted TEXT NOT NULL,
  return_path_subdomain VARCHAR(63) NOT NULL,
  last_check_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_mailer_domains_project_id ON mailer_domains(project_id);
CREATE INDEX IF NOT EXISTS idx_mailer_domains_status ON mailer_domains(status);

-- Estado cacheado de cada registro DNS esperado
CREATE TABLE IF NOT EXISTS mailer_domain_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES mailer_domains(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL,
  host VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  priority INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_check_at TIMESTAMPTZ,
  last_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain_id, host, type)
);

CREATE INDEX IF NOT EXISTS idx_mailer_domain_dns_records_domain_id
  ON mailer_domain_dns_records(domain_id);

-- Marcar dominio "principal" del proyecto (se usa como remitente por defecto)
ALTER TABLE mailer_projects
  ADD COLUMN IF NOT EXISTS default_domain_id UUID REFERENCES mailer_domains(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS mailer_domains_updated_at ON mailer_domains;
CREATE TRIGGER mailer_domains_updated_at BEFORE UPDATE ON mailer_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS mailer_domain_dns_records_updated_at ON mailer_domain_dns_records;
CREATE TRIGGER mailer_domain_dns_records_updated_at BEFORE UPDATE ON mailer_domain_dns_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();