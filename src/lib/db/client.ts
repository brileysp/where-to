import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * When DATABASE_URL is set (Supabase), use real Postgres. Otherwise fall
 * back to PGlite (a real Postgres engine compiled to WASM, no Docker/server
 * required) for local dev with data persisted to ./pgdata on disk.
 *
 * DATABASE_URL points at Supabase's connection pooler (Supavisor, port
 * 6543), not the direct-connection host — the direct host has no IPv4
 * address at all on this project, only IPv6, which made it unreachable
 * from networks (or Node versions) that don't route IPv6 cleanly. The
 * pooler resolves over IPv4. Its tradeoff: transaction-mode pooling
 * doesn't support server-side prepared statements, so `prepare: false`
 * is required here — without it, queries fail or connections reset.
 */
const databaseUrl = process.env.DATABASE_URL;

export const db = databaseUrl
  ? drizzlePostgres(postgres(databaseUrl, { prepare: false }), { schema })
  : drizzlePglite(new PGlite('./pgdata'), { schema });
