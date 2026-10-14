import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as schema from '@/lib/db/schema';

// In-memory Postgres standing in for Supabase; nothing here touches the real database.
const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({
  get db() {
    return h.db;
  },
}));

type Db = ReturnType<typeof drizzle<typeof schema>>;
let db: Db;
let dir: string;
let file: string;

const place = (id: string, name: string) => ({ id, name, region: 'Nowhere', emoji: '🧪', climate: 'temperate' as const, about: 'x', baseScores: {}, isPrimaryDestination: true });

/** A fresh "process": drop the in-memory cache and re-import the module. */
async function freshModule() {
  delete (globalThis as { __primaryPlaceRowsCache?: unknown }).__primaryPlaceRowsCache;
  vi.resetModules();
  return import('@/lib/db/queries/primary-place-rows');
}

beforeAll(async () => {
  db = drizzle(new PGlite(), { schema });
  h.db = db;
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  await db.insert(schema.places).values([place('a', 'Alpha'), place('b', 'Beta')]);
  dir = mkdtempSync(path.join(tmpdir(), 'place-snap-'));
  file = path.join(dir, 'rows.json');
}, 60_000);

afterAll(() => {
  delete process.env.PLACE_ROWS_SNAPSHOT;
  rmSync(dir, { recursive: true, force: true });
});

describe('place-row snapshot (scripts only)', () => {
  it('does nothing unless PLACE_ROWS_SNAPSHOT is set', async () => {
    delete process.env.PLACE_ROWS_SNAPSHOT;
    const m = await freshModule();
    expect((await m.getPrimaryPlaceRows()).map((r) => r.id)).toEqual(['a', 'b']);
    expect(existsSync(file)).toBe(false);
  });

  it('writes a snapshot after the first full read', async () => {
    process.env.PLACE_ROWS_SNAPSHOT = file;
    const m = await freshModule();
    const rows = await m.getPrimaryPlaceRows();
    expect(rows).toHaveLength(2);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toHaveLength(2);
  });

  it('a new process reuses unchanged rows from the snapshot and fetches only changed ones', async () => {
    // Tag a row in the file only. If the next "process" returns the tag, it came from the snapshot, not the database.
    const snap = JSON.parse(readFileSync(file, 'utf8')) as Array<Record<string, unknown>>;
    snap.find((r) => r.id === 'a')!.name = 'FROM SNAPSHOT';
    writeFileSync(file, JSON.stringify(snap));
    // Change row b in the database (newer updatedAt) and add row c.
    await db.update(schema.places).set({ name: 'Beta v2', updatedAt: new Date(Date.now() + 5000) }).where(eq(schema.places.id, 'b'));
    await db.insert(schema.places).values(place('c', 'Gamma'));

    const m = await freshModule();
    const rows = await m.getPrimaryPlaceRows();
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(Object.keys(byId).sort()).toEqual(['a', 'b', 'c']);
    expect(byId.a.name).toBe('FROM SNAPSHOT'); // untouched row: not re-downloaded
    expect(byId.b.name).toBe('Beta v2'); // changed row: refreshed
    expect(byId.c.name).toBe('Gamma'); // new row: picked up
    expect(byId.a.updatedAt).toBeInstanceOf(Date);
    // and the snapshot was brought up to date
    expect((JSON.parse(readFileSync(file, 'utf8')) as unknown[]).length).toBe(3);
  });

  it('drops a row that was deleted from the database', async () => {
    await db.delete(schema.places).where(eq(schema.places.id, 'c'));
    const m = await freshModule();
    expect((await m.getPrimaryPlaceRows()).map((r) => r.id)).toEqual(['a', 'b']);
  });
});
