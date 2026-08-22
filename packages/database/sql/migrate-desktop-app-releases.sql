-- MatuMailer: releases del cliente desktop (Windows / Android)
CREATE TABLE IF NOT EXISTS desktop_app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('windows', 'android')),
  version VARCHAR(32) NOT NULL,
  build_number INT NOT NULL DEFAULT 1,
  title VARCHAR(200),
  notes TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT,
  sha256 VARCHAR(64),
  download_url TEXT,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  is_latest BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, version, build_number)
);

CREATE INDEX IF NOT EXISTS idx_desktop_releases_platform_latest
  ON desktop_app_releases(platform, is_latest, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_desktop_releases_platform_build
  ON desktop_app_releases(platform, build_number DESC);

-- Solo una fila is_latest=true por plataforma (ayuda a consultas simples).
-- Al publicar un release nuevo, marcar el anterior is_latest=false.

DROP TRIGGER IF EXISTS desktop_app_releases_updated_at ON desktop_app_releases;
CREATE TRIGGER desktop_app_releases_updated_at
  BEFORE UPDATE ON desktop_app_releases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed: se inserta desde scripts/seed-desktop-release.mjs tras subir el ZIP.
