import { describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import { bestForFromRatings, validateContent } from '../../src/lib/gemini/validate';
import { generationOutputSchemaFlatV2Fit, normalizeFlatOutput, type GenerationOutput } from '../../src/lib/gemini/schema';
import { FACT_GROUP_LABELS, RULES_TAB_KEYS, divingFormatCallouts, factDefsFor, parseFact } from '../../src/lib/admin/interest-pages/config';
import { oldNameIssues, loadRenamedPlaces } from '../../src/lib/gemini/renamed-places';

// An in-memory Postgres stands in for the app database in the last test; nothing here touches Supabase.
const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({
  get db() {
    return h.db;
  },
}));

// Snorkeling & diving also returns diving_rating, snorkeling_rating and best_for (prompts/_drafts/diving-v1-draft.md §2a).
const months = Array.from({ length: 12 }, (_, i) => ({ score: i === 4 ? 8.4 : 5.1 + i * 0.1, text: `Month ${i}: calm water and clear reef views at the main sites, with turtles regularly seen on day boat trips.` }));
const out = (extras: Record<string, number | string> | undefined): GenerationOutput => ({
  overview: 'A reef of shallow coral gardens and deep walls lines the island, and manta rays gather at cleaning stations from December to April.',
  monthly: months,
  sources: [],
  confidence: 'high',
  flags: [],
  ...(extras ? { extras } : {}),
});
const messages = (o: GenerationOutput) => validateContent(o, 'diving', 'x').filter((i) => /rating|best_for/.test(i.message));

describe('best_for from the two ratings', () => {
  it('is both when the ratings are within 1.5, otherwise the higher discipline', () => {
    expect(bestForFromRatings(8, 7)).toBe('both');
    expect(bestForFromRatings(8, 6.6)).toBe('both');
    expect(bestForFromRatings(8, 6.5)).toBe('diving');
    expect(bestForFromRatings(3, 8)).toBe('snorkeling');
  });
});

describe('validating the fit fields', () => {
  it('accepts consistent ratings near the peak', () => {
    expect(messages(out({ diving_rating: 8.4, snorkeling_rating: 7.5, best_for: 'both' }))).toEqual([]);
  });
  it('rejects a best_for that does not follow the ratings', () => {
    const issues = messages(out({ diving_rating: 8.4, snorkeling_rating: 2, best_for: 'both' }));
    expect(issues.some((i) => i.severity === 'reject')).toBe(true);
  });
  it('warns when neither rating is near the peak score', () => {
    const issues = messages(out({ diving_rating: 5, snorkeling_rating: 4.5, best_for: 'both' }));
    expect(issues.some((i) => i.severity === 'warning')).toBe(true);
    expect(issues.some((i) => i.severity === 'reject')).toBe(false);
  });
  it('does nothing for interests that do not return the fields', () => {
    expect(messages(out(undefined))).toEqual([]);
  });
});

describe('four or more months at 10.0', () => {
  const tens = (n: number): GenerationOutput => ({ ...out(undefined), monthly: months.map((m, i) => ({ ...m, score: i < n ? 10 : 6 + i * 0.1 })) });
  it('warns, but does not reject, from four months', () => {
    const w = (n: number) => validateContent(tens(n), 'diving', 'x').filter((i) => /score 10\.0/.test(i.message));
    expect(w(3)).toEqual([]);
    expect(w(4).map((i) => i.severity)).toEqual(['warning']);
    expect(w(6).map((i) => i.severity)).toEqual(['warning']);
  });
});

describe('diving text checks', () => {
  const place = (extras: Record<string, number | string>, text: string, score = 8.9): GenerationOutput => ({
    overview: 'Sharks gather at remote islands, an animal destination rather than a coral reef.',
    monthly: Array.from({ length: 12 }, (_, i) => ({ score: i === 6 ? 10 : score, text: i === 6 ? 'Cold water brings the biggest sharks to the northern islands.' : text })),
    sources: [], confidence: 'high', flags: [], extras,
  });
  const run = (o: GenerationOutput) => validateContent(o, 'diving', 'x').filter((i) => /Month|self-rating|Self-rating/.test(i.message));
  const ex = { diving_rating: 10, snorkeling_rating: 8.5, best_for: 'diving' };
  it('warns when an off-season month at a diving-led place does not say so', () => {
    expect(run(place(ex, 'Warm calm water makes comfortable diving and snorkeling around the central islands.')).length).toBeGreaterThan(0);
  });
  it('is satisfied when the blurb says the diving draw is out of season', () => {
    expect(run(place(ex, 'Off-season for the big sharks and for diving, but snorkeling with sea lions and turtles is still good.')).filter((i) => /out of season/.test(i.message))).toEqual([]);
  });
  it('warns when a month scores above both ratings, and on banned self-rating words', () => {
    expect(run(place({ diving_rating: 7, snorkeling_rating: 6, best_for: 'both' }, 'Off-season, but snorkeling is still good.', 9.2)).some((i) => /above both ratings/.test(i.message))).toBe(true);
    expect(run(place(ex, 'Off-season for diving, but stunning snorkeling with sea lions.')).some((i) => /self-rating/i.test(i.message))).toBe(true);
    // only egregious filler is flagged; ordinary praise such as "excellent" is not (owner, 10 Oct 2026)
    expect(run(place(ex, 'Off-season for diving, but excellent snorkeling with sea lions.')).some((i) => /self-rating/i.test(i.message))).toBe(false);
  });
  it('does not apply to a low place with no real diving draw', () => {
    expect(run(place({ diving_rating: 3, snorkeling_rating: 0.5, best_for: 'diving' }, 'Winter conditions stop dive charters.', 1)).filter((i) => /out of season/.test(i.message))).toEqual([]);
  });
  it('only applies to the diving interest', () => {
    expect(validateContent(place(ex, 'Warm calm water makes comfortable diving.'), 'safari', 'x').some((i) => /out of season/.test(i.message))).toBe(false);
  });
});

describe('the wire schema', () => {
  const flat = {
    score_max: 8.4, score_min: 5.1,
    ...Object.fromEntries(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].flatMap((m, i) => [[`score_${m}`, i === 4 ? 8.4 : 5.1], [`blurb_${m}`, 'Calm, clear water at the main reef.']])),
    blurb_overall: 'A reef lines the island.',
    diving_rating: 8.4, snorkeling_rating: 6, best_for: 'diving',
  };
  it('requires the three fields and keeps them as extras after normalizing', () => {
    expect(generationOutputSchemaFlatV2Fit.safeParse({ ...flat, best_for: undefined }).success).toBe(false);
    expect(generationOutputSchemaFlatV2Fit.safeParse({ ...flat, best_for: 'neither' }).success).toBe(false);
    const parsed = generationOutputSchemaFlatV2Fit.parse(flat);
    expect(normalizeFlatOutput(parsed).output.extras).toEqual({ diving_rating: 8.4, snorkeling_rating: 6, best_for: 'diving' });
  });
});

describe('the diving data columns', () => {
  const defs = factDefsFor('diving');
  const def = (k: string) => defs.find((d) => d.key === k)!;
  it('has the three columns and validates them', () => {
    expect(defs.map((d) => d.key)).toEqual(['divingRating', 'snorkelingRating', 'bestFor', 'drawType', 'accessStyle', 'certification', 'typicalDepth', 'current', 'waterTemp', 'animals', 'drawSourceChecked', 'scopeNote', 'mustMention', 'extraAvoid']);
    expect(parseFact(def('divingRating'), '8.46')).toEqual({ ok: true, value: 8.5 });
    expect(parseFact(def('snorkelingRating'), '11').ok).toBe(false);
    expect(parseFact(def('bestFor'), 'diving')).toEqual({ ok: true, value: 'diving' });
    expect(parseFact(def('bestFor'), 'neither').ok).toBe(false);
    expect(parseFact(def('accessStyle'), ['liveaboard', 'dayBoat'])).toEqual({ ok: true, value: ['dayBoat', 'liveaboard'] });
    expect(parseFact(def('accessStyle'), 'helicopter').ok).toBe(false);
    expect(parseFact(def('certification'), 'advanced')).toEqual({ ok: true, value: 'advanced' });
    expect(parseFact(def('current'), 'strong')).toEqual({ ok: true, value: 'strong' });
    expect(parseFact(def('typicalDepth'), '10-25 m')).toEqual({ ok: true, value: '10-25 m' });
    expect(parseFact(def('animals'), 'Manta ray (likely, Dec-Apr)').ok).toBe(true);
  });
});

describe('storing the fit fields when a generation is applied', () => {
  it('writes the three columns, keeps other columns, and clears only them for N/A', async () => {
    const { writeExtraFacts } = await import('../../src/lib/gemini/apply');
    const schema = await import('../../src/lib/db/schema');
    const client = new PGlite();
    const db = drizzle(client, { schema });
    h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    const read = async () => (await db.select().from(schema.placeInterestFacts).where(eq(schema.placeInterestFacts.placeId, 'p')))[0]?.facts;

    await writeExtraFacts('p', 'diving', { diving_rating: 8.4, snorkeling_rating: 6, best_for: 'diving' }, false);
    expect(await read()).toEqual({ divingRating: 8.4, snorkelingRating: 6, bestFor: 'diving' });

    await db.update(schema.placeInterestFacts).set({ facts: { divingRating: 8.4, snorkelingRating: 6, bestFor: 'diving', draw: 'strong' } }).where(eq(schema.placeInterestFacts.placeId, 'p'));
    await writeExtraFacts('p', 'diving', { diving_rating: 5, snorkeling_rating: 5, best_for: 'both' }, false);
    expect(await read()).toEqual({ divingRating: 5, snorkelingRating: 5, bestFor: 'both', draw: 'strong' });

    await writeExtraFacts('p', 'diving', undefined, true);
    expect(await read()).toEqual({ draw: 'strong' });

    // A generation with no extras (another interest) writes nothing.
    await writeExtraFacts('other', 'birding', undefined, false);
    expect((await db.select().from(schema.placeInterestFacts).where(eq(schema.placeInterestFacts.placeId, 'other'))).length).toBe(0);
  }, 30000);
});

describe('calculated format callouts (snorkeling & diving)', () => {
  const typical = { accessStyle: ['dayBoat'], certification: 'openWater', typicalDepth: '15-100 ft', current: 'mild', waterTemp: '81-86 F', drawType: 'reef', animals: 'Green turtle (likely, year-round)' };
  it('is empty for a typical place', () => {
    expect(divingFormatCallouts(typical)).toEqual({ recorded: true, reasons: [] });
  });
  it('is not recorded when the columns are blank', () => {
    expect(divingFormatCallouts({})).toEqual({ recorded: false, reasons: [] });
  });
  it('lists exactly what differs', () => {
    const gal = divingFormatCallouts({ accessStyle: ['dayBoat', 'liveaboard'], certification: 'advanced', typicalDepth: '35-100 ft', current: 'strong', waterTemp: '61-82 F (cold Jun-Nov)', drawType: 'animals' });
    expect(gal.reasons.join('|')).toMatch(/Advanced/);
    expect(gal.reasons.join('|')).toMatch(/strong current/);
    expect(gal.reasons.join('|')).toMatch(/animals over rock/);
    expect(gal.reasons.join('|')).not.toMatch(/liveaboard/);
  });
  it('catches cold water, deep sites, shore diving, baited encounters and whale swims', () => {
    expect(divingFormatCallouts({ ...typical, waterTemp: '50-61 F (7 mm wetsuit)' }).reasons.join('|')).toMatch(/cold water/);
    expect(divingFormatCallouts({ ...typical, typicalDepth: '35-130 ft' }).reasons.join('|')).toMatch(/deep main sites/);
    expect(divingFormatCallouts({ ...typical, accessStyle: ['shore'] }).reasons.join('|')).toMatch(/shore/);
    expect(divingFormatCallouts({ ...typical, accessStyle: ['liveaboard'] }).reasons.join('|')).toMatch(/liveaboard only/);
    expect(divingFormatCallouts({ ...typical, accessStyle: ['shore', 'liveaboard'] }).reasons.join('|')).toMatch(/no day boats/);
    expect(divingFormatCallouts({ ...typical, animals: 'Tiger shark (likely, baited)' }).reasons.join('|')).toMatch(/baited/);
    expect(divingFormatCallouts({ ...typical, animals: 'Humpback whale (likely, Aug-Oct, regulated in-water swims)' }).reasons.join('|')).toMatch(/swims/);
  });
  it('treats the Mediterranean and places with a day boat among several ways as typical on temperature and access', () => {
    expect(divingFormatCallouts({ ...typical, accessStyle: ['dayBoat', 'shore'], waterTemp: '55-79 F' }).reasons).toEqual([]);
  });
});

describe('old names surviving in generated text', () => {
  const renamed = loadRenamedPlaces();
  it('knows the renamed places', () => {
    expect(renamed.get('borabora')?.newName).toBe('French Polynesia');
  });
  it('warns when the old name appears for a renamed place, and not otherwise', () => {
    expect(oldNameIssues('borabora', ['Bora Bora lagoon shallows with blacktip sharks.'], renamed).length).toBe(1);
    expect(oldNameIssues('borabora', ['Tuamotu passes with grey reef sharks.'], renamed)).toEqual([]);
    expect(oldNameIssues('seychelles', ['Bora Bora lagoon.'], renamed)).toEqual([]);
    expect(oldNameIssues('havana', ['Dive sites around Havana are few.'], renamed).length).toBe(1);
  });
});

describe('hiking columns (built empty, 13 Oct 2026)', () => {
  it('has the nine core columns in order, then the source-checked flag and the notes', () => {
    expect(factDefsFor('hiking').map((d) => d.key)).toEqual(['topTrails', 'ways', 'dayHikeRating', 'trekRating', 'season', 'altitude', 'permits', 'crowds', 'hazards', 'drawSourceChecked', 'scopeNote', 'mustMention', 'extraAvoid']);
  });
  it('every column has a hint and a known group', () => {
    for (const d of factDefsFor('hiking')) { expect((d.hint ?? '').length).toBeGreaterThan(10); expect(FACT_GROUP_LABELS[d.group]).toBeDefined(); }
  });
  it('the ways column is a multi-select of the five kinds of walking', () => {
    const ways = factDefsFor('hiking').find((d) => d.key === 'ways')!;
    expect(parseFact(ways, ['summits', 'dayHikes'])).toEqual({ ok: true, value: ['dayHikes', 'summits'] });
    expect(parseFact(ways, ['climbing']).ok).toBe(false);
  });
  it('shows a rules tab', () => {
    expect(RULES_TAB_KEYS.has('hiking')).toBe(true);
    expect(RULES_TAB_KEYS.has('surfing')).toBe(true);
    expect(RULES_TAB_KEYS.has('whaleWatching')).toBe(true);
  });
});
