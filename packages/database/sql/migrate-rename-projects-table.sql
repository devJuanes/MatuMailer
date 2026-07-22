-- Renombra la tabla de aplicación para no chocar con "projects" de la plataforma MatuDB.
-- Ejecutar en el SQL Editor del PROYECTO (esquema del tenant), NO en public de plataforma.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'projects'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'mailer_projects'
  ) THEN
    ALTER TABLE projects RENAME TO mailer_projects;
    ALTER INDEX IF EXISTS idx_projects_user_id RENAME TO idx_mailer_projects_user_id;
  END IF;
END $$;
