import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Loads .env.local manually before anything imports ./client. Run via
 * `tsx` from the CLI (not through Next.js, which auto-loads .env.local),
 * process.env.DATABASE_URL is unset at module-evaluation time — and
 * ./client reads it eagerly at import, so a static top-level `import {
 * db } from './client'` here would silently fall back to the local
 * PGlite sandbox instead of migrating the real database. Every other
 * script in this repo already loads .env.local explicitly for the same
 * reason (see scripts/audit-scoring-consistency.ts's own comment on this
 * exact failure mode); ./client is imported dynamically below, after this
 * runs, so it picks up the real DATABASE_URL.
 */
function loadDotEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '..', '..', '.env.local'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = v;
  }
}

async function main() {
  loadDotEnvLocal();
  const { db } = await import('./client');
  const migrate = process.env.DATABASE_URL
    ? (await import('drizzle-orm/postgres-js/migrator')).migrate
    : (await import('drizzle-orm/pglite/migrator')).migrate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: './drizzle' });
  console.log(process.env.DATABASE_URL ? 'Migrations applied to the real database.' : 'Migrations applied to the local PGlite sandbox (no DATABASE_URL in .env.local).');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
