-- ════════════════════════════════════════════════════════════════════════════
-- MatuMailer · Migraciones completas
--
-- Aplica TODO lo nuevo (aliases, columnas faltantes, índices, triggers)
-- en una sola pasada. Es idempotente: se puede correr varias veces sin
-- duplicar ni romper.
--
-- Cómo correrlo:
--   psql "$MATUDB_URL" -f scripts/migrate-all.sql
--
-- (o desde el directorio raíz del repo MatuMailer:)
--   psql "$(grep '^MATUDB_URL=' .env | cut -d= -f2- | tr -d '\r')" \
--     -f packages/database/sql/migrate-all.sql
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabla: mailer_domains (Resend-style domains)
-- ─────────────────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_mailer_domains_project_id
  ON mailer_domains(project_id);
CREATE INDEX IF NOT EXISTS idx_mailer_domains_status
  ON mailer_domains(status);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tabla: mailer_domain_dns_records (cache del estado DNS)
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Columna: mailer_projects.default_domain_id
--    (para que un proyecto tenga un "dominio por defecto" al enviar)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE mailer_projects
  ADD COLUMN IF NOT EXISTS default_domain_id UUID REFERENCES mailer_domains(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Tabla: mailer_domain_aliases (info@dominio.com, etc.)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mailer_domain_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES mailer_domains(id) ON DELETE CASCADE,
  local_part VARCHAR(64) NOT NULL,
  full_email VARCHAR(255) NOT NULL,
  display_name VARCHAR(120),
  reply_to VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain_id, local_part)
);

CREATE INDEX IF NOT EXISTS idx_mailer_domain_aliases_domain_id
  ON mailer_domain_aliases(domain_id);
CREATE INDEX IF NOT EXISTS idx_mailer_domain_aliases_full_email
  ON mailer_domain_aliases(full_email);
CREATE INDEX IF NOT EXISTS idx_mailer_domain_aliases_active_default
  ON mailer_domain_aliases(domain_id, is_default)
  WHERE is_default = TRUE;

-- Una sola fila `default=true` por dominio (índice único parcial).
-- Garantiza la regla de negocio "un único alias default por dominio".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'mailer_domain_aliases'
      AND indexname = 'uq_mailer_domain_aliases_default'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_mailer_domain_aliases_default
             ON mailer_domain_aliases(domain_id)
             WHERE is_default = TRUE';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Triggers updated_at para todas las tablas nuevas
--    (reusan la función update_updated_at_column() que ya existe en
--    schema.sql; si tu DB no la tiene, la creamos como fallback).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mailer_domains_updated_at ON mailer_domains;
CREATE TRIGGER mailer_domains_updated_at BEFORE UPDATE ON mailer_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS mailer_domain_dns_records_updated_at ON mailer_domain_dns_records;
CREATE TRIGGER mailer_domain_dns_records_updated_at BEFORE UPDATE ON mailer_domain_dns_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS mailer_domain_aliases_updated_at ON mailer_domain_aliases;
CREATE TRIGGER mailer_domain_aliases_updated_at BEFORE UPDATE ON mailer_domain_aliases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

ALTER TABLE project_onboarding DROP COLUMN IF EXISTS smtp_completed_at;
DROP TRIGGER IF EXISTS smtp_configs_updated_at ON smtp_configs;
DROP TABLE IF EXISTS smtp_configs;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Verificación final
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  'mailer_domains' AS tabla,
  (SELECT COUNT(*) FROM mailer_domains) AS filas
UNION ALL
SELECT
  'mailer_domain_dns_records',
  (SELECT COUNT(*) FROM mailer_domain_dns_records)
UNION ALL
SELECT
  'mailer_domain_aliases',
  (SELECT COUNT(*) FROM mailer_domain_aliases);

\echo
\echo '✓ Migración completa. Tablas nuevas y triggers activos.'
\echo '  · Para probar la nueva API: GET /api/aliases?projectId=<uuid>'
\echo '  · Para crear un alias:      POST /api/aliases { domainId, localPart }'
\echo '  · Para enviar:             POST /api/emails/send { to, from, subject, html }'
\echo