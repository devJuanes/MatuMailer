-- Limpia mensajes de prueba (@example.com) de la bandeja.
-- Ejecutar en MatuDB SQL editor si hace falta a mano.

DELETE FROM inbound_messages
WHERE lower(from_email) LIKE '%@example.com'
   OR lower(to_email) LIKE '%@example.com';
