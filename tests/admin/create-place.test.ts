import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '@/lib/db/schema';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({ get db() { return h.db; } }));
const admin = { id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com' } as never;

// 18 Nov 2026, step 4 of the naming plan: nobody types a place id any more. A new place gets the next unused key, its name becomes the label, and the slug is unique.
describe('creating a place', () => {
  let create: typeof import('@/lib/admin/create-place');
  let db: ReturnType<typeof drizzle<typeof schema>>;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }); h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    create = await import('@/lib/admin/create-place');
  }, 60_000);

  it('gives the first new place the next key, its label and a slug, with one current label in the history', async () => {
    const r = await create.insertNewPlace(admin, { name: 'Lima', region: 'Peru', climate: 'temperate' });
    expect(r).toEqual({ key: 'p0001', slug: 'lima' });
    const [p] = await db.select().from(schema.places).where(eq(schema.places.id, 'p0001')); expect(p.name).toBe('Lima'); expect(p.isPublished).toBe(false);
    const [i] = await db.select().from(schema.placeIdentity).where(eq(schema.placeIdentity.key, 'p0001'));
    expect(i).toMatchObject({ label: 'Lima', slug: 'lima', placeId: 'p0001', scopeStatus: 'draft', scopeVersion: 1 });
    const hist = await db.select().from(schema.placeLabelHistory).where(eq(schema.placeLabelHistory.placeKey, 'p0001'));
    expect(hist.filter((x) => x.isCurrent).map((x) => x.label)).toEqual(['Lima']);
  });

  it('gives the next place the next key and a different slug when the name repeats', async () => {
    const r = await create.insertNewPlace(admin, { name: 'Lima', region: 'Ohio, USA', climate: 'temperate' });
    expect(r).toEqual({ key: 'p0002', slug: 'lima-2' });
  });

  it('never reuses a slug that is a retired slug or an old id', async () => {
    await db.insert(schema.placeIdRedirects).values({ oldId: 'cusco', placeKey: 'p0001', note: 'test' });
    const r = await create.insertNewPlace(admin, { name: 'Cusco', region: 'Peru', climate: 'highland' });
    expect(r).toEqual({ key: 'p0003', slug: 'cusco-2' });
  });

  it('still checks the other fields', async () => {
    expect(await create.insertNewPlace(admin, { name: '', region: 'x', climate: 'temperate' })).toEqual({ error: 'Name and region are required.' });
    expect(await create.insertNewPlace(admin, { name: 'Oz', region: 'x', climate: 'nowhere' })).toEqual({ error: 'Pick a climate.' });
  });
});
