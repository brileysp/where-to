import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '@/lib/db/schema';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({
  get db() {
    return h.db;
  },
}));
const USER = '00000000-0000-0000-0000-0000000000aa';
vi.mock('@/lib/supabase/current-user', () => ({ getCurrentUserId: async () => USER }));

type Db = ReturnType<typeof drizzle<typeof schema>>;
let db: Db;
let actions: typeof import('@/app/onboarding-v2/actions');

beforeAll(async () => {
  db = drizzle(new PGlite(), { schema });
  h.db = db;
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  actions = await import('@/app/onboarding-v2/actions');
});

const profile = {
  v: 1,
  levels: { hiking: 'top', golf: 'like' },
  subs: { hiking: ['day-hikes'] },
  bands: { budget: ['luxury'], weather: ['cold', 'cool', 'warm', 'hot'], vibe: ['secluded', 'easygoing', 'lively', 'highenergy'], physical: ['easy', 'moderate', 'active', 'challenging'] },
  care: { food: { o: ['vegan'], firm: true } },
  who: [],
  home: 'SFO',
  vibes: ['beach'],
  answers: [],
  month: null,
  week: 0,
  maxHours: 0,
};

describe('saving the onboarding profile', () => {
  it('has nothing to load before anything is saved', async () => {
    expect(await actions.loadTravelProfile()).toBeNull();
  });
  it('saves the profile, the Travel DNA state and the preferences, and loads the profile back', async () => {
    const r = await actions.saveTravelProfile(profile);
    expect(r).toEqual({ ok: true });
    const loaded = await actions.loadTravelProfile();
    expect(loaded?.levels).toEqual({ hiking: 'top', golf: 'like' });
    expect(loaded?.home).toBe('SFO');
    const [dna] = await db.select().from(schema.userDnaState).where(eq(schema.userDnaState.userId, USER));
    expect((dna.state as { completedOnboarding: boolean; pickedInterests: string[] }).completedOnboarding).toBe(true);
    expect((dna.state as { pickedInterests: string[] }).pickedInterests.sort()).toEqual(['golf', 'outdoors']);
    const [prefs] = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, USER));
    expect(prefs.weights.hiking).toBe(9.5);
    expect(prefs.weights.golf).toBe(5);
    expect(prefs.bands.budget).toEqual(['luxury']);
    expect(prefs.monthChosen).toBe(false);
    expect(prefs.personaId).toBeNull();
  });
  it('overwrites a second save, and keeps a month the traveler already chose on the results page when dates are not kept', async () => {
    await db.update(schema.userPreferences).set({ month: 4, monthChosen: true }).where(eq(schema.userPreferences.userId, USER));
    await actions.saveTravelProfile({ ...profile, levels: { surfing: 'top' } });
    expect((await actions.loadTravelProfile())?.levels).toEqual({ surfing: 'top' });
    const [prefs] = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, USER));
    expect(prefs.month).toBe(4);
    expect(prefs.weights.surfing).toBe(9.5);
  });
  it('writes the month when dates are kept', async () => {
    await actions.saveTravelProfile({ ...profile, month: 9, week: 2 });
    const [prefs] = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, USER));
    expect(prefs.month).toBe(10);
    expect(prefs.monthChosen).toBe(true);
  });
  it('refuses a profile it cannot read, and cleans what it saves', async () => {
    expect(await actions.saveTravelProfile({ nope: true })).toEqual({ ok: false, message: 'That profile could not be read' });
    await actions.saveTravelProfile({ ...profile, levels: { hiking: 'top', madeUp: 'top' }, home: 'xx' });
    const loaded = await actions.loadTravelProfile();
    expect(loaded?.levels).toEqual({ hiking: 'top' });
    expect(loaded?.home).toBeNull();
  });
});
