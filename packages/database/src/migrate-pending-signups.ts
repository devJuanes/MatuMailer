/**
 * Aplica la migración pending_signups en MatuDB.
 * Uso: npm run db:migrate:pending-signups --workspace=@matumailer/database
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMatuDb } from './client';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseSqlStatements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const sqlPath = join(__dirname, '../sql/migrate-pending-signups.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  const db = getMatuDb();
  const statements = parseSqlStatements(sql);

  for (const statement of statements) {
    console.log(`→ ${statement.slice(0, 70).replace(/\s+/g, ' ')}…`);
    const { error } = await db.rpc(statement);
    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  console.log('✅ Tabla pending_signups creada correctamente.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
