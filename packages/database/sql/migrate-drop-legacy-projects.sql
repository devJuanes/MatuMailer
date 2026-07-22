-- Elimina la tabla legacy "projects" que choca con la plataforma MatuDB.
-- Solo ejecutar si ya existe "mailer_projects" con el mismo propósito.
-- Si "projects" tiene datos y "mailer_projects" está vacía, migrar antes:
--   INSERT INTO mailer_projects SELECT * FROM projects;

DO $$
BEGIN
  IF current_schema() NOT LIKE 'proj\_%' ESCAPE '\' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'projects'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'mailer_projects'
  ) THEN
    -- Si projects tiene filas y mailer_projects no, copiar antes de borrar
    IF (SELECT COUNT(*) FROM projects) > 0 AND (SELECT COUNT(*) FROM mailer_projects) = 0 THEN
      INSERT INTO mailer_projects SELECT * FROM projects;
    END IF;
    DROP TABLE projects CASCADE;
  END IF;
END $$;
