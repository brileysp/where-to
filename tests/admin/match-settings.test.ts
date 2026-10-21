import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import * as schema from '@/lib/db/schema';
import { DEFAULT_MATCH_SETTINGS } from '@/lib/scoring/matchSettings';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({
  get db() {
    return h.db;
  },
}));
vi.mock('@/lib/admin/auth', () => ({
  requireAdminUser: async () => ({ id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com' }),
}));

describe('matching settings', () => {
  let a: typeof import('@/app/admin/destinations/matching/actions');
  let server: typeof import('@/lib/scoring/matchSettingsServer');
  beforeAll(async () => {
    const db = drizzle(new PGlite(), { schema });
    h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    a = await import('@/app/admin/destinations/matching/actions');
    server = await import('@/lib/scoring/matchSettingsServer');
  });

  it('starts at the defaults with nothing stored', async () => {
    const r = await server.loadMatchSettings();
    expect(r.settings).toEqual(DEFAULT_MATCH_SETTINGS);
    expect(r.changed).toEqual({});
  });

  it('saves only what differs from the defaults and reads it back', async () => {
    const r = await a.saveMatchSettings({ ...DEFAULT_MATCH_SETTINGS, keepIfLeanMissed: 0.75 });
    expect(r.ok && r.changed).toEqual({ keepIfLeanMissed: 0.75 });
    const back = await server.loadMatchSettings();
    expect(back.settings.keepIfLeanMissed).toBe(0.75);
    expect(back.settings.keepIfLimitMissed).toBe(DEFAULT_MATCH_SETTINGS.keepIfLimitMissed);
    const rows = await (h.db as ReturnType<typeof drizzle<typeof schema>>).select().from(schema.appSettings);
    expect(rows[0].value).toEqual({ keepIfLeanMissed: 0.75 });
  });

  it('refuses numbers out of range, and a floor above what a missed Limit keeps, without changing anything', async () => {
    expect((await a.saveMatchSettings({ ...DEFAULT_MATCH_SETTINGS, keepIfLeanMissed: 4 })).ok).toBe(false);
    expect((await a.saveMatchSettings({ ...DEFAULT_MATCH_SETTINGS, interestFloor: 0.8 })).ok).toBe(false);
    expect((await server.loadMatchSettings()).settings.keepIfLeanMissed).toBe(0.75);
  });

  it('resets to the defaults and records each change in the audit log', async () => {
    const r = await a.resetMatchSettings();
    expect(r.ok && r.changed).toEqual({});
    expect((await server.loadMatchSettings()).settings).toEqual(DEFAULT_MATCH_SETTINGS);
    const audit = await (h.db as ReturnType<typeof drizzle<typeof schema>>).select().from(schema.adminAuditLog);
    expect(audit.filter((x) => x.entityType === 'app_settings').length).toBe(2);
  });
});
