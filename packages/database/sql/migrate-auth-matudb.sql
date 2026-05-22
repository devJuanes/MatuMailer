-- Migración: autenticación delegada a MatuDB Auth
-- Ejecutar en tu proyecto MatuDB si ya tenías el schema anterior

ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS password_hash;

DROP TABLE IF EXISTS sessions;

-- Si tenías usuarios demo antiguos con otro id, elimínalos o alinea manualmente con MatuDB Auth
