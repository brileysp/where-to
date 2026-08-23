import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * When DATABASE_URL is set (Supabase), use real Postgres. Otherwise fall
 * back to PGlite (a real Postgres engine compiled to WASM, no Docker/server
 * required) for local dev with data persisted to ./pgdata on disk.
 */
const databaseUrl = process.env.DATABASE_URL;

export const db = databaseUrl
  ? drizzlePostgres(postgres(databaseUrl), { schema })
  : drizzlePglite(new PGlite('./pgdata'), { schema });
