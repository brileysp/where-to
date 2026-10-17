import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '@/lib/db/schema';
import { parseFact, factDefsFor, sightingsCount, optionLabel, bestOdds, allFactDefs, BANNED_FACT_KEYS } from '@/lib/admin/interest-pages/config';

// An in-memory Postgres (PGlite) with the real migrations applied, standing in for
// the app database, and a fake signed-in admin. Nothing here touches Supabase.
const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({
  get db() {
    return h.db;
  },
}));
vi.mock('@/lib/admin/auth', () => ({
  requireAdminUser: async () => ({ id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com' }),
}));

type Db = ReturnType<typeof drizzle<typeof schema>>;
let db: Db;
let actions: typeof import('@/app/admin/destinations/interests/[key]/actions');

beforeAll(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema });
  h.db = db;
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  await db.insert(schema.places).values({
    id: 'test-place',
    name: 'Test Place',
    region: 'Nowhere',
    emoji: '🧪',
    climate: 'temperate',
    about: 'A place for tests.',
    baseScores: {},
  });
  actions = await import('@/app/admin/destinations/interests/[key]/actions');
}, 60_000);

const def = (key: string) => factDefsFor('birding').find((d) => d.key === key)!;

describe('parseFact', () => {
  it('accepts whole numbers with commas and rejects the rest', () => {
    expect(parseFact(def('species'), '1,600')).toEqual({ ok: true, value: 1600 });
    expect(parseFact(def('species'), '12.5').ok).toBe(false);
    expect(parseFact(def('species'), 'abc').ok).toBe(false);
    expect(parseFact(def('species'), '-3').ok).toBe(false);
  });
  it('keeps ratings between 0 and 10 with one decimal', () => {
    expect(parseFact(def('viewsPhoto'), '8.46')).toEqual({ ok: true, value: 8.5 });
    expect(parseFact(def('viewsPhoto'), '11').ok).toBe(false);
  });
  it('clears a fact when emptied, and splits bird lists', () => {
    expect(parseFact(def('charisma'), '  ')).toEqual({ ok: true, value: null });
    expect(parseFact(def('headlineBirds'), ' Quetzal (likely), Scarlet Macaw (possible) ')).toEqual({ ok: true, value: 'Quetzal (likely), Scarlet Macaw (possible)' });
    expect(parseFact(def('headlineBirds'), ['Quetzal', 'Scarlet Macaw'])).toEqual({ ok: true, value: 'Quetzal, Scarlet Macaw' });
    expect(parseFact(def('draw'), 'huge').ok).toBe(false);
  });
  it('checks safari likelihood and choice values, and counts likely-or-better animals', () => {
    const sdef = (key: string) => factDefsFor('safari').find((d) => d.key === key)!;
    expect(parseFact(sdef('lion'), 'likely')).toEqual({ ok: true, value: 'likely' });
    expect(parseFact(sdef('lion'), 'sometimes').ok).toBe(false);
    expect(parseFact(sdef('malaria'), 'seasonal')).toEqual({ ok: true, value: 'seasonal' });
    expect(parseFact(sdef('malaria'), 'extreme').ok).toBe(false);
    expect(parseFact(sdef('lion'), '')).toEqual({ ok: true, value: null });
    expect(parseFact(sdef('headlineAnimals'), 'Lion, Leopard')).toEqual({ ok: true, value: ['Lion', 'Leopard'] });
    expect(optionLabel(sdef('rhino'), 'notPresent')).toBe('Not present');
    const c = sightingsCount(factDefsFor('safari'), { lion: 'guaranteed', leopard: 'likely', elephant: 'possible', tiger: 'notPresent' });
    expect(c).toEqual({ good: 2, total: 10, recorded: 4 });
  });
  it('never defines a banned column such as seasonal exceptions or best months', () => {
    for (const d of allFactDefs()) expect(BANNED_FACT_KEYS as readonly string[]).not.toContain(d.key);
  });
  it('has two endemic species columns for birding, strict and regional', () => {
    const keys = factDefsFor('birding').map((d) => d.key);
    expect(keys).toContain('endemicSpecies');
    expect(keys).toContain('endemicSpeciesRegional');
  });
  it('defines the wildlife columns, with habituated as a tag, and sorts animal cells by best odds', () => {
    const wl = factDefsFor('wildlifeViewing');
    expect(wl.filter((d) => d.animals).map((d) => d.key)).toEqual(['predators', 'herbivores', 'primates', 'birds', 'herps', 'marineLife', 'otherMammals']);
    expect(wl.some((d) => d.key === 'habituated')).toBe(false);
    expect(wl.some((d) => d.key === 'bestMonths')).toBe(false);
    expect(bestOdds('Grizzly bear (possible), Wolf (unlikely)')).toBe(2);
    expect(bestOdds('Bison (guaranteed), Elk (likely)')).toBe(4);
    expect(bestOdds('13 monkey species')).toBe(-1);
    expect(bestOdds(undefined)).toBe(-1);
    expect(parseFact(wl.find((d) => d.key === 'primates')!, 'Indri (likely), 100+ lemur species')).toEqual({ ok: true, value: 'Indri (likely), 100+ lemur species' });
    const how = wl.find((d) => d.key === 'howWatch')!;
    // How you watch takes several ways at once, stored in the order the options are listed; "mixed" no longer exists.
    expect(parseFact(how, ['boat', 'vehicle'])).toEqual({ ok: true, value: ['vehicle', 'boat'] });
    expect(parseFact(how, 'hide')).toEqual({ ok: true, value: ['hide'] });
    expect(parseFact(how, 'mixed').ok).toBe(false);
    expect(parseFact(how, [])).toEqual({ ok: true, value: null });
  });
  it('defines one column per whale plus a separate dolphins column, with odds and months in the cell', () => {
    const wh = factDefsFor('whaleWatching');
    expect(wh.filter((d) => d.animals).map((d) => d.key)).toEqual(['humpback', 'sperm', 'minke', 'orca', 'blue', 'fin', 'gray', 'right', 'otherWhales', 'dolphins']);
    expect(wh.map((d) => d.key)).toContain('watchShore');
    expect(bestOdds('Humpback whale (likely, Jun–Sep)')).toBe(3);
    expect(bestOdds("Bryde's whale (possible, Nov–Mar), pilot whale (likely, year-round)")).toBe(3);
    expect(parseFact(wh.find((d) => d.key === 'humpback')!, 'Humpback whale (likely, Jun–Sep)')).toEqual({ ok: true, value: 'Humpback whale (likely, Jun–Sep)' });
    // Boat style takes several styles at once, stored in option order; "mixed" no longer exists.
    const boat = wh.find((d) => d.key === 'boatStyle')!;
    expect(parseFact(boat, ['sailing', 'inflatable'])).toEqual({ ok: true, value: ['inflatable', 'sailing'] });
    expect(parseFact(boat, 'inflatable')).toEqual({ ok: true, value: ['inflatable'] });
    expect(parseFact(boat, 'mixed').ok).toBe(false);
    const draw = factDefsFor('diving').find((d) => d.key === 'drawType')!;
    expect(parseFact(draw, ['wrecks', 'reef'])).toEqual({ ok: true, value: ['reef', 'wrecks'] });
    expect(parseFact(draw, 'mixed').ok).toBe(false);
    const wave = factDefsFor('surfing').find((d) => d.key === 'waveType')!;
    expect(parseFact(wave, ['reef', 'beach'])).toEqual({ ok: true, value: ['beach', 'reef'] });
    expect(parseFact(wave, 'mixed').ok).toBe(false);
  });
});

describe('interest page actions', () => {
  it('saves, merges and clears a fact, and writes audit rows', async () => {
    const a = await actions.saveFact('birding', 'test-place', 'species', '1,000');
    expect(a).toEqual({ ok: true, value: 1000 });
    await actions.saveFact('birding', 'test-place', 'viewsPhoto', 9);
    const [row] = await db.select().from(schema.placeInterestFacts).where(eq(schema.placeInterestFacts.placeId, 'test-place'));
    expect(row.facts).toEqual({ species: 1000, viewsPhoto: 9 });
    await actions.saveFact('birding', 'test-place', 'species', '');
    const [row2] = await db.select().from(schema.placeInterestFacts).where(eq(schema.placeInterestFacts.placeId, 'test-place'));
    expect(row2.facts).toEqual({ viewsPhoto: 9 });
    const audits = await db.select().from(schema.adminAuditLog).where(eq(schema.adminAuditLog.entityType, 'place_interest_fact'));
    expect(audits.length).toBe(3);
  });

  it('rejects bad facts, unknown fields, places and interests', async () => {
    expect((await actions.saveFact('birding', 'test-place', 'species', 'lots')).ok).toBe(false);
    expect((await actions.saveFact('birding', 'test-place', 'nonsense', 1)).ok).toBe(false);
    expect((await actions.saveFact('birding', 'no-such-place', 'species', 1)).ok).toBe(false);
    expect((await actions.saveFact('not-an-interest', 'test-place', 'species', 1)).ok).toBe(false);
  });

  it('adds, edits and deletes an expert review', async () => {
    const bad = await actions.addReview('birding', { placeId: null, reviewerName: ' ', reviewerRole: null, reviewedOn: '2026-10-05', notes: '' });
    expect(bad.ok).toBe(false);
    const badDate = await actions.addReview('birding', { placeId: null, reviewerName: 'A. Expert', reviewerRole: null, reviewedOn: '5 Oct', notes: '' });
    expect(badDate.ok).toBe(false);
    const made = await actions.addReview('birding', { placeId: 'test-place', reviewerName: 'A. Expert', reviewerRole: 'Tour leader', reviewedOn: '2026-10-05', notes: 'Checked the feeder claims.' });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.review).toMatchObject({ reviewerName: 'A. Expert', placeId: 'test-place', createdBy: 'tester@example.com' });
    const edited = await actions.updateReview('birding', made.review.id, { placeId: null, reviewerName: 'A. Expert', reviewerRole: '', reviewedOn: '2026-10-06', notes: 'Rechecked.' });
    expect(edited.ok && edited.review).toMatchObject({ placeId: null, reviewerRole: null, reviewedOn: '2026-10-06', notes: 'Rechecked.' });
    expect((await actions.updateReview('safari', made.review.id, { placeId: null, reviewerName: 'x', reviewerRole: null, reviewedOn: '2026-10-06', notes: '' })).ok).toBe(false);
    expect((await actions.deleteReview('birding', made.review.id)).ok).toBe(true);
    expect(await db.select().from(schema.interestReviews)).toHaveLength(0);
  });

  it('adds, edits and removes a reference site, and keeps the addresses unique', async () => {
    const bad = await actions.addReferenceSite('birding', { siteUrl: 'nonsense', label: 'x', goodFor: '', usefulness: 50, aiAccess: 'ai', lastUsedOn: null, placesChecked: 0 });
    expect(bad.ok).toBe(false);
    expect((await actions.addReferenceSite('birding', { siteUrl: '10000birds.com', label: '10,000 Birds', goodFor: '', usefulness: 0, aiAccess: 'ai', lastUsedOn: null, placesChecked: 0 })).ok).toBe(false);
    expect((await actions.addReferenceSite('birding', { siteUrl: '10000birds.com', label: '10,000 Birds', goodFor: '', usefulness: 101, aiAccess: 'ai', lastUsedOn: null, placesChecked: 0 })).ok).toBe(false);
    expect((await actions.addReferenceSite('birding', { siteUrl: '10000birds.com', label: '10,000 Birds', goodFor: '', usefulness: 60, aiAccess: 'ai', lastUsedOn: '5 Oct', placesChecked: 0 })).ok).toBe(false);
    const made = await actions.addReferenceSite('birding', { siteUrl: '10000birds.com', label: '10,000 Birds', goodFor: 'Trip reports', usefulness: 72, aiAccess: 'ai', lastUsedOn: '2026-10-06', placesChecked: 12 });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.site).toMatchObject({ siteUrl: 'https://10000birds.com', aiAccess: 'ai', usefulness: 72, lastUsedOn: '2026-10-06', placesChecked: 12 });
    expect((await actions.addReferenceSite('birding', { siteUrl: 'https://10000birds.com', label: 'Again', goodFor: '', usefulness: 50, aiAccess: 'ai', lastUsedOn: '', placesChecked: 0 })).ok).toBe(false);
    // The same site on a different interest is fine.
    const other = await actions.addReferenceSite('safari', { siteUrl: '10000birds.com', label: '10,000 Birds', goodFor: '', usefulness: 40, aiAccess: 'ai', lastUsedOn: '', placesChecked: 0 });
    expect(other.ok && other.site.lastUsedOn).toBeNull();
    expect((await actions.addReferenceSite('birding', { siteUrl: 'ebird.org', label: 'eBird', goodFor: '', usefulness: 90, aiAccess: 'robot' as never, lastUsedOn: null, placesChecked: 0 })).ok).toBe(false);
    const edited = await actions.updateReferenceSite('birding', made.site.id, { siteUrl: 'https://10000birds.com', label: '10,000 Birds', goodFor: 'Trip reports', usefulness: '80', aiAccess: 'human', lastUsedOn: '2026-12-01', placesChecked: '20' });
    expect(edited.ok && edited.site).toMatchObject({ aiAccess: 'human', usefulness: 80, lastUsedOn: '2026-12-01', placesChecked: 20 });
    expect((await actions.updateReferenceSite('safari', made.site.id, { siteUrl: 'a.com', label: 'x', goodFor: '', usefulness: 50, aiAccess: 'ai', lastUsedOn: '', placesChecked: 0 })).ok).toBe(false);
    expect((await actions.deleteReferenceSite('birding', made.site.id)).ok).toBe(true);
    if (other.ok) expect((await actions.deleteReferenceSite('safari', other.site.id)).ok).toBe(true);
    expect(await db.select().from(schema.interestReferenceSites)).toHaveLength(0);
    const audits = await db.select().from(schema.adminAuditLog).where(eq(schema.adminAuditLog.entityType, 'interest_reference_site'));
    expect(audits.length).toBeGreaterThanOrEqual(5);
  });

  it('tracks when an outstanding item is done', async () => {
    const made = await actions.addTodo('birding', { title: 'Do the thing', detail: '', status: 'needs_you', source: 'test' });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.todo.doneAt).toBeNull();
    const done = await actions.updateTodo('birding', made.todo.id, { title: 'Do the thing', detail: '', status: 'done', source: 'test' });
    expect(done.ok && done.todo.doneAt).toBeTruthy();
    const reopened = await actions.updateTodo('birding', made.todo.id, { title: 'Do the thing', detail: '', status: 'idea', source: 'test' });
    expect(reopened.ok && reopened.todo.doneAt).toBeNull();
    expect((await actions.addTodo('birding', { title: '', detail: '', status: 'idea', source: '' })).ok).toBe(false);
    expect((await actions.deleteTodo('birding', made.todo.id)).ok).toBe(true);
  });

  it('adds, moves and deletes a place idea', async () => {
    const made = await actions.addIdea('birding', { name: 'Somewhere New', region: 'Earth', why: 'Birds.', nearestExisting: '', stage: 'idea' });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const moved = await actions.updateIdea('birding', made.idea.id, { name: 'Somewhere New', region: 'Earth', why: 'Birds.', nearestExisting: 'Test Place', stage: 'verified' });
    expect(moved.ok && moved.idea.stage).toBe('verified');
    expect((await actions.deleteIdea('birding', made.idea.id)).ok).toBe(true);
    expect(await db.select().from(schema.interestPlaceIdeas)).toHaveLength(0);
  });

  it('does not drop the cached place rows when it saves something (that would cost a 5.8 MB re-download)', async () => {
    const { getPrimaryPlaceRows } = await import('@/lib/db/queries/primary-place-rows');
    await db.update(schema.places).set({ isPrimaryDestination: true }).where(eq(schema.places.id, 'test-place'));
    await getPrimaryPlaceRows();
    const cache = () => (globalThis as { __primaryPlaceRowsCache?: { rows: unknown[] | null } }).__primaryPlaceRowsCache;
    expect(cache()?.rows).not.toBeNull();
    await actions.saveFact('birding', 'test-place', 'charisma', 7);
    await actions.addTodo('birding', { title: 'Cache check', detail: '', status: 'idea', source: '' });
    expect(cache()?.rows).not.toBeNull();
  });

  it('defines the six surfing columns added in October 2026', () => {
    const sf = factDefsFor('surfing');
    const get = (k: string) => sf.find((d) => d.key === k)!;
    expect(['waveDirection', 'boards', 'access', 'localism', 'lessons', 'permits'].every((k) => !!get(k))).toBe(true);
    expect(parseFact(get('boards'), ['stepUp', 'longboard'])).toEqual({ ok: true, value: ['longboard', 'stepUp'] });
    expect(parseFact(get('access'), 'boat')).toEqual({ ok: true, value: 'boat' });
    expect(parseFact(get('localism'), 'friendly').ok).toBe(false);
    expect(parseFact(get('permits'), '  A park pass is needed  ')).toEqual({ ok: true, value: 'A park pass is needed' });
  });
});
