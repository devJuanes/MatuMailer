-- Renombra la tabla de aplicación para no chocar con "projects" de la plataforma MatuDB.
-- Ejecutar SOLO en el SQL Editor del PROYECTO (esquema proj_*), NUNCA en public.
--
-- PROTECCIÓN: aborta si current_schema() es public (BD de plataforma MatuDB).

DO $$
BEGIN
  IF current_schema() = 'public' THEN
    RAISE EXCEPTION
      'ABORT: no ejecutar migrate-rename-projects-table en schema public. '
      'Esto rompe MatuDB plataforma (projects -> mailer_projects). '
      'Usa el SQL Editor del proyecto MatuSendMail (schema proj_*).';
  END IF;

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
