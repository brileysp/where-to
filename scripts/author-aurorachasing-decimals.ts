import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Same de-flattening pass as whaleWatching/safari (see docs/interest-
// content-authoring-playbook.md §2). This interest's audit surfaced two
// classes of bug beyond simple flatness:
//  1. Direct text/score contradictions — Svalbard's May-July literally say
//     "no darkness, so no aurora" but scored 9; Southeast Alaska's summer
//     months (near-constant light, "effectively invisible" per its own
//     overview) scored HIGHER than its winter "regular dark season"
//     months — backwards. Fixed with real values, not just decimals.
//  2. A recurring "same odds as January" claim in several destinations'
//     text that didn't actually match January's score, and a few months
//     explicitly called out as a genuine "equinox bump" or "best
//     incidental odds of the year" that were nonetheless tied with the
//     flat, unrelated off-season baseline.
// True 10.0 stays reserved for the destinations whose own text makes the
// most extreme, specific reliability claim: Svalbard ("even a quiet night
// can deliver, no storm required"), Churchill ("~300 nights a year"),
// Finnish Lapland ("lights on well over half of clear nights"), and
// Iceland ("no rare storm required"). Denali-interior's own data never
// claimed a 10 to begin with, so it's a straightforward consistency fix,
// not a de-flattening case.
const KEY = 'auroraChasing';

interface Fix {
  scores: Partial<Record<number, number>>;
  text: Partial<Record<number, string>>;
}

const EXPLICIT: Record<string, Fix> = {
  lapland: {
    // Jan/Feb/Nov/Dec were flat 10 (4 months) — keep the deepest-winter
    // core at true 10, pull November down as the block's own shoulder.
    scores: { 10: 9.5 },
    text: { 10: 'The season is reaching its strongest stretch as nights lengthen toward the solstice.' },
  },
  lofoten: {
    // May/Jun/Jul shared "Midnight sun — no darkness" text but scored a
    // smooth 2.01/2.5/2.99 (a leftover curve-interpolation artifact) —
    // flattened to match the same concept's value everywhere else in the
    // catalog (Lapland, Greenland use 2.0 flat for this exact situation).
    scores: { 4: 2, 5: 2, 6: 2 },
    text: {},
  },
  'denali-interior': {
    // Jan/Oct/Dec shared the identical "full dark season, best windows"
    // sentence but scored 9/7/8.33 — a real internal inconsistency. Also
    // has the same midnight-sun interpolation artifact as Lofoten.
    scores: { 0: 9.2, 4: 2, 5: 2, 6: 2, 9: 7.8, 11: 9.0 },
    text: {
      9: 'The season is just beginning to build back toward its strongest stretch.',
    },
  },
  iceland: {
    // Same midnight-sun artifact as Lofoten/Denali. Also unifies the
    // Jan/Nov/Dec "full dark season" trio at true 10 alongside February
    // (explicitly called "statistically the strongest month" in its own
    // text — the strongest specific claim of the four, so it keeps the
    // ceiling too), pulling November down as the block's shoulder.
    scores: { 4: 2, 5: 2, 6: 2, 10: 9.6 },
    text: { 10: 'Full dark season is returning, close to its strongest stretch.' },
  },
  svalbard: {
    // May/June/July directly contradict their own text ("no darkness, so
    // no aurora") by scoring 9 — brought down to match the same "midnight
    // sun, no aurora" concept's value everywhere else in the catalog.
    // April/August (real but reduced darkness at the edges of that window)
    // were also tied with the true polar-night months at 9 — given their
    // own shoulder text, they're pulled down too. Jan/Feb/Mar/Oct/Nov/Dec
    // were flat 10 across 6 months; kept true 10 for the deepest polar
    // night (Dec/Jan/Feb) and pulled the shoulder months down.
    scores: { 2: 9.6, 3: 6.5, 4: 2, 5: 2, 6: 2, 7: 6.5, 8: 7.6, 9: 9.6, 10: 9.6 },
    text: {
      3: 'Real darkness most nights, but the window is closing fast as the sun starts staying up longer.',
      7: 'The sun is setting again by month’s end, though darkness is still limited.',
    },
  },
  'southeast-alaska': {
    // The summer months (near-constant light per the destination's own
    // overview: "effectively invisible in summer's near-constant light")
    // were scored HIGHER (5) than the regular winter dark season (3) —
    // backwards. Corrected so winter > equinox-bump > shoulder > deep
    // summer, matching the overview's own claim.
    scores: { 0: 3.4, 1: 3.4, 2: 4.2, 3: 1.4, 4: 0.4, 5: 0.3, 6: 0.4, 7: 1.0, 8: 4.2, 9: 3.4, 10: 3.4, 11: 3.4 },
    text: {
      3: 'Light is returning fast; odds are dropping sharply as real darkness disappears.',
      4: 'Nights are almost gone as the summer solstice approaches — effectively invisible.',
      5: 'The summer solstice brings the least darkness of the year — effectively invisible.',
      6: 'Still effectively invisible most nights, though the longest days are just past.',
      7: 'A real, if still modest, return as nights begin lengthening again.',
    },
  },
  'glacier-waterton': {
    // Every single month was flat at 2, despite the text describing
    // genuinely different situations (a real storm-dependent winter
    // chance vs. summer nights "too light for a realistic look").
    scores: { 0: 2.4, 1: 2.4, 2: 2.2, 3: 0.4, 4: 0.4, 5: 0.4, 6: 0.4, 7: 0.4, 8: 1.8, 9: 2.2, 10: 2.4, 11: 2.4 },
    text: {},
  },
  fjords: {
    // April/May shared identical "too light" text but scored 2/2.5. Also
    // Feb/Nov/Dec's text explicitly claims "same odds as January" without
    // actually matching January's score — brought into line with that claim.
    scores: { 1: 9.0, 3: 2, 4: 2, 10: 9.0, 11: 9.0 },
    text: {},
  },
  banff: {
    // Jan/Dec share the identical "full dark season, best windows"
    // sentence but scored 8/7.5.
    scores: { 11: 8.0 },
    text: {},
  },
  greenland: {
    // Same Jan/Dec identical-text mismatch (8 vs 7.5).
    scores: { 11: 8.0 },
    text: {},
  },
  tasmania: {
    // Oct/Nov/Dec share the exact same "days are too long" sentence as
    // Jan-Mar's flat 3, but scored a declining 2/2.5/3 instead.
    scores: { 9: 3, 10: 3 },
    text: {},
  },
  acadia: {
    // September's own text calls it "the best incidental odds of the year"
    // yet it was tied with the flat "too light" summer baseline (2).
    // October's text says it's fading FROM that bump, but scored higher
    // (3) than September (2) — backwards. Both corrected.
    scores: { 8: 2.8, 9: 2.4 },
    text: {},
  },
  'milford-sound-fiordland': {
    // September's text ("effectively over... a genuine long shot, at
    // best") implies some real chance, yet it scored a flat 0 — lower
    // than the "days are too long for a realistic look" months (2),
    // which sound more definitively closed off. July's text explicitly
    // claims "same strong odds as June" without matching June's score.
    scores: { 6: 4.0, 8: 1.2 },
    text: {},
  },
  whistler: {
    // April/May scored LOWER (0/0) than June (2) despite April/May being
    // closer to real darkness than the near-solstice low point in June —
    // backwards seasonal direction. Also Oct/Nov/Dec share the EXACT same
    // "within the season, same odds as January" sentence but scored a
    // rising 3/4/4.5 instead of matching each other or January (5).
    scores: { 3: 1.2, 4: 0.6, 5: 0.4, 6: 0.6, 7: 1.0, 9: 4.3, 10: 4.7, 11: 4.7 },
    text: {},
  },
  'upper-peninsula': {
    // November/December share the exact same "within the season, same
    // odds as January" sentence but scored 4/4.5 instead of matching.
    scores: { 10: 4.7, 11: 4.7 },
    text: {},
  },
  vermont: {
    // March and October are both explicitly called a genuine equinox
    // "bump"/"one of the stronger months" yet tied with the flat 2
    // baseline — corrected to sit meaningfully above it.
    scores: { 2: 2.8, 9: 2.8 },
    text: {},
  },
  falklands: {
    // July's own text claims "same strong odds as June" without matching
    // June's score (5 vs 4.5).
    scores: { 6: 5 },
    text: {},
  },
  churchill: {
    // Already internally consistent (Jan/Nov/Dec is exactly the ideal
    // 3-month true-10 core, matching its own "~300 nights a year, one of
    // the most reliable places on Earth" claim) — listed EXPLICIT purely
    // to keep those three at the literal 10.0 the generic mechanical cap
    // would otherwise strip from every destination, Churchill included.
    scores: { 0: 10, 10: 10, 11: 10 },
    text: {},
  },
};

// Already internally consistent — mechanical nudge only, no text changes.
const MECHANICAL_ONLY = [
  'vancouver-island', 'scottish-highlands-skye', 'faroe-islands',
  'tierra-del-fuego',
];

const ALL_IDS = [...Object.keys(EXPLICIT), ...MECHANICAL_ONLY];

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function findRuns(monthly: number[]): { start: number; len: number; value: number }[] {
  const runs: { start: number; len: number; value: number }[] = [];
  const visited = new Array(12).fill(false);
  for (let i = 0; i < 12; i++) {
    if (visited[i]) continue;
    const v = monthly[i];
    let len = 1;
    while (len < 12 && monthly[(i + len) % 12] === v) len++;
    if (len === 12) {
      runs.push({ start: 0, len: 12, value: v });
      for (let k = 0; k < 12; k++) visited[k] = true;
      break;
    }
    let back = 0;
    while (back < 11 && monthly[(i - back - 1 + 12) % 12] === v) back++;
    const start = (i - back + 12) % 12;
    const fullLen = back + len;
    for (let k = 0; k < fullLen; k++) visited[(start + k) % 12] = true;
    runs.push({ start, len: fullLen, value: v });
  }
  return runs;
}

function mechanicalNudge(monthly: number[]): number[] {
  const result = [...monthly];
  for (const run of findRuns(monthly)) {
    if (run.value === 0 || !Number.isInteger(run.value)) continue;
    const prevVal = monthly[(run.start - 1 + 12) % 12];
    const nextVal = monthly[(run.start + run.len) % 12];
    const risesBefore = prevVal > run.value;
    const risesAfter = nextVal > run.value;
    let value: number;
    if (run.value >= 10) {
      value = run.len <= 3 ? 9.8 : 9.6;
    } else if (risesBefore && risesAfter) {
      value = run.value + 0.15;
    } else if (risesBefore || risesAfter) {
      value = run.value + 0.3;
    } else {
      value = run.value - 0.2;
    }
    value = round1(Math.max(0.1, Math.min(9.8, value)));
    for (let k = 0; k < run.len; k++) result[(run.start + k) % 12] = value;
  }
  return result;
}

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(inArray(places.id, ALL_IDS));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ALL_IDS) {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const scored = scorePlace(row);
    const liveAurora = scored.monthly[KEY];

    let newScores: Record<number, number>;
    let textPatch: Record<number, string> = {};

    if (EXPLICIT[id]) {
      newScores = { ...EXPLICIT[id].scores } as Record<number, number>;
      textPatch = EXPLICIT[id].text as Record<number, string>;
      const afterExplicit = liveAurora.map((v, i) => (i in newScores ? newScores[i] : v));
      const nudged = mechanicalNudge(afterExplicit);
      for (let i = 0; i < 12; i++) if (!(i in newScores) && nudged[i] !== afterExplicit[i]) newScores[i] = nudged[i];
    } else {
      const nudged = mechanicalNudge(liveAurora);
      newScores = {};
      for (let i = 0; i < 12; i++) if (nudged[i] !== liveAurora[i]) newScores[i] = nudged[i];
    }

    const finalOverride: Record<number, number> = { ...(scoreOverridesBefore[KEY] || {}) };
    let changedCount = 0;
    for (const [idxStr, val] of Object.entries(newScores)) {
      const idx = Number(idxStr);
      if (liveAurora[idx] !== val) changedCount++;
      finalOverride[idx] = val;
    }

    const patch: Record<string, unknown> = {
      scoreOverrides: { ...scoreOverridesBefore, [KEY]: finalOverride },
    };
    if (Object.keys(textPatch).length > 0) {
      const mw = [...((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] || new Array(12).fill(null))];
      for (const [idxStr, text] of Object.entries(textPatch)) mw[Number(idxStr)] = text;
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: mw };
    }

    console.log(`\n${row.name} (${id}) — ${changedCount} months changed`);
    for (let i = 0; i < 12; i++) {
      if (i in newScores && liveAurora[i] !== newScores[i]) {
        console.log(`  ${MONTH_NAMES[i].padEnd(10)} ${liveAurora[i]} -> ${newScores[i]}${textPatch[i] ? '  [text updated]' : ''}`);
      }
    }

    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
  }

  console.log(dryRun ? '\n\ndry run — nothing written.' : '\n\ndone — written to scoreOverrides / sliderMonthlyWeather.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
