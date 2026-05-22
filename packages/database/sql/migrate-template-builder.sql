-- Creador visual de plantillas: guarda el diseño en bloques (JSON)
ALTER TABLE IF EXISTS templates
  ADD COLUMN IF NOT EXISTS builder_data JSONB DEFAULT NULL;
