import { afterEach, describe, expect, it, vi } from 'vitest';

// The wrapper must do nothing in the running app (no PLACE_ROWS_SNAPSHOT) and must only answer a plain
// "select everything from places" from the disk copy; everything else goes to the database.
describe('withPlaceSnapshot', () => {
  afterEach(() => {
    delete process.env.PLACE_ROWS_SNAPSHOT;
    delete process.env.PLACE_ROWS_FRESH;
    vi.resetModules();
  });

  it('is off in the dev server even when the flag is set (argv is not a script)', async () => {
    process.env.PLACE_ROWS_SNAPSHOT = '1';
    const { isSnapshotScript } = await import('@/lib/db/script-place-snapshot');
    expect(isSnapshotScript()).toBe(false);
  });

  it('returns the database object itself when the flag is not set', async () => {
    const { withPlaceSnapshot } = await import('@/lib/db/script-place-snapshot');
    const base = { select: () => ({}) };
    expect(withPlaceSnapshot(base)).toBe(base);
  });

  it('returns the database object itself when PLACE_ROWS_FRESH is set', async () => {
    process.env.PLACE_ROWS_SNAPSHOT = '1';
    process.env.PLACE_ROWS_FRESH = '1';
    const { withPlaceSnapshot } = await import('@/lib/db/script-place-snapshot');
    const base = { select: () => ({}) };
    expect(withPlaceSnapshot(base)).toBe(base);
  });

  it('leaves a select with columns, or on another table, untouched', async () => {
    process.env.PLACE_ROWS_SNAPSHOT = '1';
    const argv1 = process.argv[1];
    process.argv[1] = '/x/scripts/fake.ts';
    const { withPlaceSnapshot } = await import('@/lib/db/script-place-snapshot');
    const sentinel = { then: () => 'direct' };
    const base = { select: vi.fn(() => ({ from: vi.fn(() => sentinel) })) };
    const db = withPlaceSnapshot(base) as unknown as { select: (c?: unknown) => { from: (t: unknown) => unknown } };
    expect(db.select({ id: 1 }).from({})).toBe(sentinel);
    expect(db.select().from({ other: true })).toBe(sentinel);
    process.argv[1] = argv1;
  });
});
