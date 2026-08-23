import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set (this script targets Supabase, not PGlite).');
  }
  const sql = postgres(process.env.DATABASE_URL);
  const script = readFileSync(path.join(__dirname, 'supabase-auth-setup.sql'), 'utf-8');
  await sql.unsafe(script);
  console.log('Supabase auth FKs + RLS policies applied.');
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
