import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq, sql } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '@/lib/db/schema';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({ get db() { return h.db; } }));
const admin = { id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com' } as never;

// 18 Nov 2026, step 6 of the naming plan: every row of hotel samples, interest facts and authored texts records the place's scope version when it is written, so widening a place lists what was
// made for the old area (the Myanmar case: three Bagan hotels measuring a country).
describe('scope version on data rows', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>; let key: string;
  let edit: typeof import('@/lib/places/edit'); let stale: typeof import('@/lib/places/scope-stale');
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }); h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    const { insertNewPlace } = await import('@/lib/admin/create-place'); edit = await import('@/lib/places/edit'); stale = await import('@/lib/places/scope-stale');
    const r = await insertNewPlace(admin, { name: 'Bagan', region: 'Myanmar', climate: 'tropical' }); if ('error' in r) throw new Error(r.error); key = r.key;
  }, 60_000);

  const addRun = () => db.insert(schema.placeHotelQuoteRuns).values({ placeId: key, searchTerm: 'Bagan', quotedOn: '2026-11-15', dates: ['2027-01-12'], listed: [3], panel: [], isCurrent: false }).returning({ v: schema.placeHotelQuoteRuns.scopeVersion });

  it('tags a new row with the place\'s current scope version, whatever the writer says', async () => {
    const [run] = await addRun(); expect(run.v).toBe(1);
    await db.insert(schema.placeInterestFacts).values({ placeId: key, interestKey: 'hiking', facts: { a: 1 } as never, scopeVersion: 99 });
    const [f] = await db.select().from(schema.placeInterestFacts).where(eq(schema.placeInterestFacts.placeId, key)); expect(f.scopeVersion).toBe(1);
  });

  it('lists nothing while the scope is unchanged, and lists the old rows after the place is widened', async () => {
    await db.update(schema.placeHotelQuoteRuns).set({ isCurrent: true }).where(eq(schema.placeHotelQuoteRuns.placeId, key));
    expect(await stale.staleScopeRows()).toEqual([]);
    await edit.changeScope(admin, key, { level: 'country', anchorsText: 'Bagan\nYangon\nInle Lake', note: 'now all of Myanmar', changesCoverage: true, confirm: true });
    const rows = await stale.staleScopeRows();
    expect(rows.map((r) => [r.what, r.count, r.oldestVersion, r.placeVersion])).toEqual([['hotel samples', 1, 1, 2], ['interest facts', 1, 1, 2]]);
    expect(stale.describeStale(rows[0])).toBe('hotel samples: 1 made for scope version 1, the place is now version 2');
  });

  it('re-tags facts when they are rewritten, and a new hotel run is made for the new scope', async () => {
    await db.update(schema.placeInterestFacts).set({ facts: { a: 2 } as never }).where(eq(schema.placeInterestFacts.placeId, key));
    await db.update(schema.placeHotelQuoteRuns).set({ isCurrent: false }).where(eq(schema.placeHotelQuoteRuns.placeId, key));
    const [run] = await addRun(); expect(run.v).toBe(2);
    await db.update(schema.placeHotelQuoteRuns).set({ isCurrent: true }).where(eq(schema.placeHotelQuoteRuns.id, (await db.select().from(schema.placeHotelQuoteRuns).where(sql`scope_version = 2`))[0].id));
    expect(await stale.staleScopeRows()).toEqual([]);
  });
});
