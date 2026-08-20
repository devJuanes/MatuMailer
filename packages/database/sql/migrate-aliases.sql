-- MatuMailer · Migración incremental: tabla mailer_domain_aliases
--
-- Si ya corriste `scripts/migrate-all.sql` o `schema.sql` actualizado, esta
-- migración es idempotente y no hará nada. Úsala solo si vienes de una versión
-- anterior SIN aliases.
--
-- Resend-style: cada alias (`info@dominio.com`, `support@dominio.com`, ...)
-- vive dentro de un `mailer_domains` verificado y se usa como `from` en el envío.

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

-- Trigger de updated_at (reusa la función si ya existe, si no la crea).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mailer_domain_aliases_updated_at ON mailer_domain_aliases;
CREATE TRIGGER mailer_domain_aliases_updated_at BEFORE UPDATE ON mailer_domain_aliases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();