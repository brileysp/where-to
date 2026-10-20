import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '@/lib/db/schema';
import { factDefsFor } from '@/lib/admin/interest-pages/config';
import { canDrive, chipFit, chipKeyFor, driverFit, driverProblem, fitBasis } from '@/lib/admin/interest-pages/chips';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({
  get db() {
    return h.db;
  },
}));
vi.mock('@/lib/admin/auth', () => ({
  requireAdminUser: async () => ({ id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com' }),
}));

const hiking = factDefsFor('hiking');
const birding = factDefsFor('birding');
const safari = factDefsFor('safari');
const whale = factDefsFor('whaleWatching');

describe('chip fits', () => {
  it('uses a rating as it is, and nothing when the rating is missing', () => {
    expect(driverFit({ column: 'dayHikeRating' }, hiking, { dayHikeRating: 6.5 })).toBe(6.5);
    expect(driverFit({ column: 'dayHikeRating' }, hiking, { ways: ['easyWalks'] })).toBeNull();
  });
  it('scales a count so it reaches 10 at the number you set', () => {
    expect(driverFit({ column: 'endemicSpecies', fullAt: 40 }, birding, { endemicSpecies: 20 })).toBe(5);
    expect(driverFit({ column: 'endemicSpecies', fullAt: 40 }, birding, { endemicSpecies: 108 })).toBe(10);
  });
  it('scores a pick-any option 10 when present and 0 when the list is there without it', () => {
    const f = { ways: ['easyWalks', 'dayHikes'] };
    expect(driverFit({ column: 'ways', option: 'easyWalks' }, hiking, f)).toBe(10);
    expect(driverFit({ column: 'ways', option: 'hutTreks' }, hiking, f)).toBe(0);
    expect(driverFit({ column: 'ways', option: 'hutTreks' }, hiking, { dayHikeRating: 5 })).toBeNull();
  });
  it('maps the sighting grid and animals text to 10, 8, 5, 2', () => {
    expect(driverFit({ column: 'lion' }, safari, { lion: 'guaranteed' })).toBe(10);
    expect(driverFit({ column: 'lion' }, safari, { lion: 'notPresent' })).toBe(0);
    expect(driverFit({ column: 'humpback' }, whale, { humpback: 'Humpback whale (likely, Jun–Sep)', watchShore: true })).toBe(8);
    expect(driverFit({ column: 'humpback' }, whale, { orca: 'Orca (possible, Jun)' })).toBe(0);
    expect(driverFit({ column: 'humpback' }, whale, {})).toBeNull();
  });
  it('reads a missing whale tick as not ticked once the place has any data', () => {
    expect(driverFit({ column: 'swimAllowed' }, whale, { orca: 'Orca (likely, Jun)' })).toBe(0);
    expect(driverFit({ column: 'swimAllowed' }, whale, { swimAllowed: true })).toBe(10);
  });
  it('takes the best driver and ignores drivers with no data', () => {
    const drivers = [{ column: 'lion' }, { column: 'leopard' }, { column: 'cheetah' }];
    expect(chipFit(drivers, safari, { lion: 'unlikely', leopard: 'likely' })).toBe(8);
    expect(chipFit(drivers, safari, {})).toBeNull();
  });
  it('says where the number came from', () => {
    expect(fitBasis([{ column: 'dayHikeRating' }], hiking, { dayHikeRating: 7 })).toBe('Day-hike rating 7');
    expect(fitBasis([{ column: 'ways', option: 'hutTreks' }], hiking, { ways: ['easyWalks'] })).toBe('What you can do: does not include "Hut-to-hut or lodge treks"');
  });
});

describe('which columns can drive a chip', () => {
  it('allows ratings, counts, ticks, choices and animals cells, and refuses notes, lists and the source tick', () => {
    expect(canDrive(hiking.find((d) => d.key === 'dayHikeRating')!)).toBe(true);
    expect(canDrive(whale.find((d) => d.key === 'humpback')!)).toBe(true);
    expect(canDrive(hiking.find((d) => d.key === 'permits')!)).toBe(false);
    expect(canDrive(hiking.find((d) => d.key === 'mustMention')!)).toBe(false);
    expect(canDrive(hiking.find((d) => d.key === 'drawSourceChecked')!)).toBe(false);
  });
  it('wants an option for a pick-any column and a full-at number for a count', () => {
    expect(driverProblem({ column: 'ways' }, hiking)).toMatch(/option/);
    expect(driverProblem({ column: 'ways', option: 'easyWalks' }, hiking)).toBeNull();
    expect(driverProblem({ column: 'species' }, birding)).toMatch(/10/);
    expect(driverProblem({ column: 'species', fullAt: 1200 }, birding)).toBeNull();
    expect(driverProblem({ column: 'nope' }, birding)).toMatch(/no longer exists/);
  });
  it('builds a stable key from the label', () => {
    expect(chipKeyFor('Hut-to-hut & lodges', new Set())).toBe('hut-to-hut-and-lodges');
    expect(chipKeyFor('Wrecks', new Set(['wrecks']))).toBe('wrecks-2');
  });
});

describe('chip actions', () => {
  let actions: typeof import('@/app/admin/destinations/interests/[key]/chip-actions');
  beforeAll(async () => {
    const db = drizzle(new PGlite(), { schema });
    h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    await db.insert(schema.places).values({ id: 'p1', name: 'P1', region: 'X', emoji: '🧪', climate: 'temperate', about: 'x', baseScores: {} });
    actions = await import('@/app/admin/destinations/interests/[key]/chip-actions');
  });

  it('creates drafts, refuses to go live without a column, and enforces five live', async () => {
    const made = [];
    for (const n of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const r = await actions.createChip('hiking', `Chip ${n}`);
      expect(r.ok).toBe(true);
      if (r.ok) made.push(r.chip);
    }
    expect(made[0].status).toBe('draft');
    const noDriver = await actions.updateChip('hiking', made[0].key, { status: 'live' });
    expect(noDriver.ok).toBe(false);
    for (const c of made) await actions.updateChip('hiking', c.key, { drivers: [{ column: 'dayHikeRating' }] });
    // Not approved yet: cannot go live.
    const unapproved = await actions.updateChip('hiking', made[0].key, { status: 'live' });
    expect(unapproved.ok).toBe(false);
    if (!unapproved.ok) expect(unapproved.message).toMatch(/not been approved/);
    for (const c of made) expect((await actions.setChipApproval('hiking', c.key, true)).ok).toBe(true);
    for (const c of made.slice(0, 5)) expect((await actions.updateChip('hiking', c.key, { status: 'live' })).ok).toBe(true);
    const sixth = await actions.updateChip('hiking', made[5].key, { status: 'live' });
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.message).toMatch(/Five chips are already live/);
  });

  it('keeps a chip that waits on a new column as a draft', async () => {
    const r = await actions.createChip('birding', 'Seabirds');
    if (!r.ok) throw new Error('create failed');
    await actions.updateChip('birding', r.chip.key, { drivers: [{ column: 'viewsPhoto' }], needsColumn: 'Bird groups' });
    const live = await actions.updateChip('birding', r.chip.key, { status: 'live' });
    expect(live.ok).toBe(false);
    const cleared = await actions.updateChip('birding', r.chip.key, { needsColumn: '' });
    expect(cleared.ok).toBe(true);
    await actions.setChipApproval('birding', r.chip.key, true);
    expect((await actions.updateChip('birding', r.chip.key, { status: 'live' })).ok).toBe(true);
  });

  it('rejects a column that does not exist and an option that is not one of the choices', async () => {
    const r = await actions.createChip('safari', 'Walks');
    if (!r.ok) throw new Error('create failed');
    expect((await actions.updateChip('safari', r.chip.key, { drivers: [{ column: 'nope' }] })).ok).toBe(false);
    await actions.updateChip('safari', r.chip.key, { drivers: [{ column: 'walking', option: 'sometimes' }] });
    expect((await actions.updateChip('safari', r.chip.key, { status: 'live' })).ok).toBe(false);
  });

  it('records who approved a chip, takes the approval back, and will not un-approve a live chip', async () => {
    const r = await actions.createChip('surfing', 'Approvable');
    if (!r.ok) throw new Error('create failed');
    expect(r.chip.approvedAt).toBeNull();
    const a = await actions.setChipApproval('surfing', r.chip.key, true);
    expect(a.ok && a.chip.approvedAt).toBeTruthy();
    expect(a.ok && a.chip.approvedBy).not.toBe('');
    const back = await actions.setChipApproval('surfing', r.chip.key, false);
    expect(back.ok && back.chip.approvedAt).toBeNull();
    await actions.updateChip('surfing', r.chip.key, { drivers: [{ column: 'beginnerRating' }] });
    await actions.setChipApproval('surfing', r.chip.key, true);
    expect((await actions.updateChip('surfing', r.chip.key, { status: 'live' })).ok).toBe(true);
    expect((await actions.setChipApproval('surfing', r.chip.key, false)).ok).toBe(false);
  });

  it('moves a chip, and keeps the order numbered 1 to n', async () => {
    const a = await actions.createChip('diving', 'First');
    const b = await actions.createChip('diving', 'Second');
    if (!a.ok || !b.ok) throw new Error('create failed');
    const moved = await actions.moveChip('diving', b.chip.key, 'up');
    expect(moved.ok && moved.order).toEqual([{ key: b.chip.key, order: 1 }, { key: a.chip.key, order: 2 }]);
  });

  it('needs a reason for an override, replaces it on a second save, and clears it', async () => {
    const c = await actions.createChip('surfing', 'Learn');
    if (!c.ok) throw new Error('create failed');
    expect((await actions.saveChipOverride('surfing', c.chip.key, 'p1', { fit: 6, reason: '  ' })).ok).toBe(false);
    expect((await actions.saveChipOverride('surfing', c.chip.key, 'p1', { fit: 11, reason: 'x' })).ok).toBe(false);
    const saved = await actions.saveChipOverride('surfing', c.chip.key, 'p1', { fit: 6.25, reason: 'Closed in 2026' });
    expect(saved.ok && saved.override.fit).toBe(6.3);
    await actions.saveChipOverride('surfing', c.chip.key, 'p1', { fit: 4, reason: 'Reopened' });
    const rows = await (h.db as ReturnType<typeof drizzle<typeof schema>>).select().from(schema.placeChipOverrides).where(eq(schema.placeChipOverrides.chipKey, c.chip.key));
    expect(rows.length).toBe(1);
    expect(rows[0].reason).toBe('Reopened');
    expect((await actions.clearChipOverride('surfing', c.chip.key, 'p1')).ok).toBe(true);
  });

  it('deleting a chip removes its overrides too', async () => {
    const c = await actions.createChip('whaleWatching', 'Orcas');
    if (!c.ok) throw new Error('create failed');
    await actions.saveChipOverride('whaleWatching', c.chip.key, 'p1', { fit: 9, reason: 'Resident pod' });
    expect((await actions.deleteChip('whaleWatching', c.chip.key)).ok).toBe(true);
    const left = await (h.db as ReturnType<typeof drizzle<typeof schema>>).select().from(schema.placeChipOverrides).where(eq(schema.placeChipOverrides.chipKey, c.chip.key));
    expect(left.length).toBe(0);
  });
});
