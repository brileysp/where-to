import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { throttleClient } from './throttle';

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

/**
 * The connection pool is kept on globalThis so it survives hot reloads and is shared by every route bundle.
 * Without this, each re-evaluation of this module (every code edit in dev, and each separate route bundle) opened
 * a brand new pool of 10 connections and never closed the old one. A long dev session ended with 60 to 120 open
 * connections, the pooler refused more, and admin pages hung for minutes. A pool of 5 that closes idle
 * connections after 20 seconds is plenty: each page runs about 8 short queries in parallel.
 */
const POOL_SIZE = 8;
const g = globalThis as typeof globalThis & { __pgClient?: ReturnType<typeof postgres>; __pgThrottled?: ReturnType<typeof postgres>; __pgliteClient?: PGlite };

function pgClient() {
  return (g.__pgClient ??= postgres(databaseUrl as string, { prepare: false, max: POOL_SIZE, idle_timeout: 20, max_lifetime: 60 * 30, connect_timeout: 20, keep_alive: 10 }));
}
/** One throttle per pool, kept with it, so a hot reload cannot stack a second throttle on the same connections. */
function pgThrottled() {
  return (g.__pgThrottled ??= throttleClient(pgClient(), POOL_SIZE));
}
function pgliteClient() {
  return (g.__pgliteClient ??= new PGlite('./pgdata'));
}

export const db = databaseUrl
  ? drizzlePostgres(pgThrottled(), { schema }) // throttled: see throttle.ts (the pooler hangs on bursts)
  : drizzlePglite(pgliteClient(), { schema });
