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

// 18 Nov 2026, step 5 of the naming plan: renaming, re-addressing and re-scoping a place are one edit each, with the history written automatically, and nothing else moves.
describe('editing a place identity', () => {
  let edit: typeof import('@/lib/places/edit'); let create: typeof import('@/lib/admin/create-place'); let resolve: typeof import('@/lib/places/lookup');
  let db: ReturnType<typeof drizzle<typeof schema>>; let key: string; let other: string;
  const ident = async (k: string) => (await db.select().from(schema.placeIdentity).where(eq(schema.placeIdentity.key, k)))[0];
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }); h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    edit = await import('@/lib/places/edit'); create = await import('@/lib/admin/create-place'); resolve = await import('@/lib/places/lookup');
    const a = await create.insertNewPlace(admin, { name: 'Bagan', region: 'Myanmar', climate: 'tropical' }); const b = await create.insertNewPlace(admin, { name: 'Inle Lake', region: 'Myanmar', climate: 'tropical' });
    if ('error' in a || 'error' in b) throw new Error('setup failed'); key = a.key; other = b.key;
  }, 60_000);

  it('renames a place: label, place name and history change, the key does not, and the old label stays on record', async () => {
    const r = await edit.changeLabel(admin, key, 'Myanmar', { reason: 'widened to the whole country' });
    expect(r).toMatchObject({ ok: true, slug: 'bagan' });
    const i = await ident(key); expect(i.label).toBe('Myanmar'); expect(i.key).toBe(key); expect(i.slug).toBe('bagan');
    const [p] = await db.select().from(schema.places).where(eq(schema.places.id, key)); expect(p.name).toBe('Myanmar');
    const hist = await db.select().from(schema.placeLabelHistory).where(eq(schema.placeLabelHistory.placeKey, key));
    expect(hist.filter((x) => x.isCurrent).map((x) => x.label)).toEqual(['Myanmar']);
    const old = hist.find((x) => !x.isCurrent); expect(old?.label).toBe('Bagan'); expect(old?.retiredNote).toMatch(/\d{4}$/);
    expect(hist.find((x) => x.isCurrent)?.reason).toBe('widened to the whole country');
  });

  it('can move the address with the name, and the old address keeps finding the place', async () => {
    const r = await edit.changeLabel(admin, key, 'Myanmar and Inle', { alsoSlug: true });
    expect(r).toMatchObject({ ok: true, slug: 'myanmar-and-inle' });
    resolve.clearIdentityCache();
    expect(await resolve.resolvePlace('bagan')).toMatchObject({ key, label: 'Myanmar and Inle' });
    expect(await resolve.resolvePlace('myanmar-and-inle')).toMatchObject({ key, how: 'slug' });
  });

  it('refuses a name another place has, an empty name and an unchanged name', async () => {
    expect(await edit.changeLabel(admin, key, 'inle lake')).toMatchObject({ ok: false });
    expect(await edit.changeLabel(admin, key, '   ')).toMatchObject({ ok: false });
    expect(await edit.changeLabel(admin, key, 'Myanmar and Inle')).toMatchObject({ ok: false });
  });

  it('changes only the address, refuses one that belongs to another place, and lets a place take back its own old address', async () => {
    expect(await edit.changeSlug(admin, key, 'inle-lake')).toMatchObject({ ok: false });
    expect(await edit.changeSlug(admin, key, 'Not Valid!')).toMatchObject({ ok: false });
    expect(await edit.changeSlug(admin, key, 'burma')).toMatchObject({ ok: true, slug: 'burma' });
    expect((await ident(key)).label).toBe('Myanmar and Inle');
    expect(await edit.changeSlug(admin, key, 'bagan')).toMatchObject({ ok: true, slug: 'bagan' });
    resolve.clearIdentityCache(); expect(await resolve.resolvePlace('burma')).toMatchObject({ key });
  });

  it('saves a scope without changing the version, and adds 1 only when the coverage changes', async () => {
    let r = await edit.changeScope(admin, key, { level: 'country', anchorsText: 'Bagan\nYangon; Inle Lake\nbagan', note: 'all of Myanmar', changesCoverage: false, confirm: true });
    expect(r.ok).toBe(true); let i = await ident(key);
    expect(i).toMatchObject({ level: 'country', scopeVersion: 1, scopeStatus: 'confirmed', scopeNote: 'all of Myanmar' }); expect(i.anchors).toEqual(['Bagan', 'Yangon', 'Inle Lake']);
    r = await edit.changeScope(admin, key, { level: 'country', anchorsText: 'Bagan\nYangon\nInle Lake\nNgapali', note: 'added the beaches', changesCoverage: true, confirm: false });
    i = await ident(key); expect(i).toMatchObject({ scopeVersion: 2, scopeStatus: 'draft' });
    expect(await edit.changeScope(admin, key, { level: 'galaxy', anchorsText: 'x', note: '', changesCoverage: false, confirm: true })).toMatchObject({ ok: false });
    expect(await edit.changeScope(admin, key, { level: 'area', anchorsText: ' \n ', note: '', changesCoverage: false, confirm: true })).toMatchObject({ ok: false });
  });

  it('confirms a draft scope as it stands, and every edit is in the audit log', async () => {
    expect(await edit.confirmScope(admin, other)).toMatchObject({ ok: true }); expect((await ident(other)).scopeStatus).toBe('confirmed');
    const log = await db.select().from(schema.adminAuditLog).where(eq(schema.adminAuditLog.entityId, key));
    expect(log.some((l) => l.entityType === 'place_identity')).toBe(true); expect(log.some((l) => l.entityType === 'destination' && l.action === 'update')).toBe(true);
  });
});
