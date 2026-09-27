import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

const KEY = 'whaleWatching';

/**
 * De-flattens whaleWatching's 8/9/10 clustering into real decimal texture,
 * driven by the ALREADY-AUTHORED monthly blurb text (never by curve
 * position alone — see docs/interest-content-authoring-playbook.md §2's
 * "decimal-precision scores must be derived from the blurb text" rule,
 * added this session after the geometric-taper approach produced real
 * violations: identical text with different scores, and vice versa).
 *
 * Two kinds of changes below:
 *  1. EXPLICIT fixes — destinations where reading the real text (and, for
 *     the five with the deepest research, live web sources) revealed a
 *     genuine mismatch between what the prose says and what the old
 *     integer score claimed. Scores AND text are corrected together.
 *  2. MECHANICAL nudge — every other flat integer run (any destination's
 *     block of identical consecutive months at one whole number) gets a
 *     single shared non-round value instead of the bare integer, biased
 *     toward whichever neighboring block is higher — the same "5 becomes
 *     5.3, the adjacent 6 becomes 5.8" compression the user asked for.
 *     Text is left untouched here: the block is still one narrative unit,
 *     just no longer suspiciously round. True 10.0 stays reserved for the
 *     five places with real global-caliber sourcing (Azores, Cape Town,
 *     Vancouver Island, Los Cabos, Southeast Alaska) and only on their own
 *     genuine peak months — everyone else's peak caps at 9.6-9.8.
 */

interface Fix {
  scores: Partial<Record<number, number>>; // 0-indexed month -> new score
  text: Partial<Record<number, string>>; // 0-indexed month -> new blurb (omit to keep existing)
}

const EXPLICIT: Record<string, Fix> = {
  azores: {
    scores: { 0: 8.3, 1: 8.3, 2: 8.7, 3: 10.0, 4: 10.0, 5: 9.2, 6: 10.0, 7: 10.0, 8: 9.4, 9: 8.8, 10: 8.3, 11: 8.3 },
    text: {},
  },
  'cape-town': {
    scores: { 5: 8.6, 6: 9.0, 7: 9.5, 8: 10.0, 9: 9.8, 10: 8.8 },
    text: {
      7: 'Whale numbers are strong and still building — calving continues, with the season not yet at its peak.',
      9: 'Numbers remain exceptional as calving and the arrival of males for mating overlap, extending the peak.',
    },
  },
  'vancouver-island': {
    scores: { 0: 8.3, 1: 8.3, 2: 8.8, 3: 9.3, 4: 9.3, 5: 9.9, 6: 10.0, 7: 10.0, 8: 10.0, 9: 9.4, 10: 8.3, 11: 8.3 },
    text: {
      2: 'Orca activity is beginning to build as the season transitions toward summer.',
      3: 'Orca activity is building quickly now, just ahead of the summer peak.',
      4: 'Season is opening — humpback and gray whales are arriving to feed, though numbers are still building toward the summer peak.',
      5: 'Peak season is beginning — resident orca pods, humpback, and gray whales are all reliably present as salmon runs build.',
      9: 'Whales remain reliably present, though Pacific storm season begins to affect trip conditions and reliability.',
    },
  },
  sydney: {
    scores: { 0: 8.3, 1: 8.3, 2: 8.3, 3: 8.3, 4: 8.8, 5: 9.7, 6: 9.8, 7: 8.8, 8: 9.2, 9: 9.8, 10: 8.6, 11: 8.3 },
    text: {
      5: 'Northbound migration is strong — humpback whales pass Sydney Heads in large numbers heading toward tropical breeding grounds.',
      6: 'Peak northbound migration — whale numbers are at their highest of the year heading north.',
      7: 'Whale numbers ease as the northbound pulse tapers, though the southbound migration is already beginning.',
      8: 'The southbound migration is building — mothers with young calves start passing Sydney Heads on their return journey.',
    },
  },
  'los-cabos': {
    scores: { 0: 10.0, 1: 10.0, 2: 9.6, 3: 7.0, 4: 2.0, 5: 2.0, 6: 2.0, 7: 2.0, 8: 2.0, 9: 2.5, 10: 4.0, 11: 8.5 },
    text: {
      2: "Whale numbers remain excellent as the season continues — often the best combination of high numbers and active surface behavior, just before the migration north begins.",
      3: "The season is winding down as whales begin their migration north to Alaska and British Columbia; sightings are still possible but numbers are dropping.",
      4: 'Whales have migrated back to Alaska and British Columbia for the summer; sightings off Los Cabos are genuinely rare this time of year.',
      5: 'Whales have migrated back to Alaska and British Columbia for the summer; sightings off Los Cabos are genuinely rare this time of year.',
      6: 'Whales have migrated back to Alaska and British Columbia for the summer; sightings off Los Cabos are genuinely rare this time of year.',
      7: 'Whales have migrated back to Alaska and British Columbia for the summer; sightings off Los Cabos are genuinely rare this time of year.',
      8: 'Whales have migrated back to Alaska and British Columbia for the summer; sightings off Los Cabos are genuinely rare this time of year.',
      9: 'Still essentially outside the season, though the very first signs of the whales’ return south can begin late in the month.',
      10: 'Whales are beginning to return to Los Cabos as the season approaches, though numbers are still well below December’s arrival surge.',
    },
  },
  'southeast-alaska': {
    scores: { 0: 8.3, 1: 8.3, 2: 8.3, 3: 8.3, 4: 9.7, 5: 10.0, 6: 10.0, 7: 10.0, 8: 9.7, 9: 8.3, 10: 8.3, 11: 8.3 },
    text: {},
  },
  iceland: {
    scores: { 0: 8.2, 1: 8.2, 2: 8.2, 3: 8.3, 4: 8.8, 5: 9.3, 6: 9.3, 7: 9.3, 8: 8.8, 9: 8.3, 10: 8.2, 11: 8.2 },
    text: {
      3: 'The season is opening — humpback and blue whales are beginning to join resident minke whales and orcas, though numbers are still building.',
      4: 'Whale numbers are building steadily toward the summer peak.',
      8: 'Whale numbers are beginning to ease as the summer peak passes.',
      9: 'The season is winding down, though minke whales and orcas remain a reliable baseline sighting.',
    },
  },
  gbr: {
    scores: { 0: 5.0, 1: 5.0, 2: 5.0, 3: 5.5, 4: 6.5, 5: 7.2, 6: 8.0, 7: 8.0, 8: 7.0, 9: 5.8, 10: 5.2, 11: 5.0 },
    text: {
      3: 'The first humpback whales are trickling in as the migration approaches.',
      4: 'Whale numbers are noticeably increasing ahead of the June-August peak.',
      9: 'A few stragglers may still pass, though the migration has largely moved south.',
      11: 'Outside the whale season, sightings along the reef settle to a quieter baseline.',
    },
  },
  'quebec-city': {
    scores: { 0: 7.2, 1: 7.2, 2: 7.2, 3: 7.2, 4: 7.8, 5: 8.3, 6: 9.1, 7: 9.1, 8: 9.1, 9: 8.1, 10: 7.2, 11: 7.2 },
    text: {
      4: 'Whale numbers are just beginning to build at Tadoussac as the summer season opens.',
      5: 'Whale numbers are building quickly at Tadoussac, closer now to the July peak.',
    },
  },
  madagascar: {
    scores: { 9: 6.8, 10: 5.2 },
    text: {
      9: 'Whale numbers remain strong just past the peak, with breeding activity still very much underway.',
      10: 'Numbers are clearly declining as the breeding season winds toward its close.',
    },
  },
  tasmania: {
    scores: { 11: 6.0 },
    text: {},
  },
  'turks-caicos': {
    scores: { 10: 4.8, 11: 4.8 },
    text: {},
  },
  borabora: {
    scores: { 3: 5.5, 4: 6.0, 5: 6.5, 6: 7.0, 7: 7.5 },
    text: {
      3: 'Whale numbers are just beginning to build ahead of the season.',
      4: 'Whale numbers continue building steadily.',
      5: 'Whale numbers are approaching the start of the breeding season.',
      6: 'Humpback whales are arriving to breed, with the season’s first swim tours underway.',
      7: 'Humpback whale numbers continue building, with dedicated swim tours running through the island’s sheltered waters.',
    },
  },
  algarve: {
    scores: {},
    text: {
      0: 'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins — rougher winter seas can also affect trip conditions.',
      1: 'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins — rougher winter seas can also affect trip conditions.',
      10: 'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins — rougher winter seas can also affect trip conditions.',
      11: 'Outside the migration season, sightings settle to a quieter baseline of resident minke whales and dolphins — rougher winter seas can also affect trip conditions.',
    },
  },
  hokkaido: {
    scores: { 6: 7.0, 7: 7.5 },
    text: {
      6: 'Orca season is just ending as sperm whales become the more reliable sighting.',
      7: 'Sperm whales are now the dominant sighting in the Nemuro Strait, with orca season behind for the year.',
    },
  },
};

// Every other whale-watching destination with a peak >= 8 in the original
// sweep — gets the mechanical nudge only (no text changes), computed below.
const MECHANICAL_ONLY = [
  'churchill', 'monterey-big-sur', 'antarctica', 'maui', 'lofoten', 'fjords',
  'big-island', 'andalucia', 'marlborough-abel-tasman', 'costa-rica', 'madeira',
  'nova-scotia', 'punta-cana', 'cape-cod-islands', 'srilanka', 'north-island',
  'tierra-del-fuego', 'acadia', 'greenland', 'canaries', 'svalbard', 'ireland',
];

const ALL_IDS = [...Object.keys(EXPLICIT), ...MECHANICAL_ONLY];

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Every maximal cyclic run of an identical value in a 12-month array. */
function findRuns(monthly: number[]): { start: number; len: number; value: number }[] {
  const runs: { start: number; len: number; value: number }[] = [];
  const visited = new Array(12).fill(false);
  for (let i = 0; i < 12; i++) {
    if (visited[i]) continue;
    const v = monthly[i];
    let len = 1;
    while (len < 12 && monthly[(i + len) % 12] === v) len++;
    // Don't double count a run that wraps and was already recorded starting earlier.
    let start = i;
    if (len === 12) {
      runs.push({ start: 0, len: 12, value: v });
      for (let k = 0; k < 12; k++) visited[k] = true;
      break;
    }
    // Walk backward to find the run's true start if it wraps into earlier indices.
    let back = 0;
    while (back < 11 && monthly[(i - back - 1 + 12) % 12] === v) back++;
    start = (i - back + 12) % 12;
    const fullLen = back + len;
    for (let k = 0; k < fullLen; k++) visited[(start + k) % 12] = true;
    runs.push({ start, len: fullLen, value: v });
  }
  return runs;
}

/**
 * Mechanical de-flattening for a destination NOT individually re-researched
 * this session: every flat integer run (skipping literal 0 — a hard
 * "inaccessible" floor, not a score) becomes one shared non-round value,
 * nudged toward whichever neighbor is higher (a "shoulder" reads as closer
 * to the good part of the year than a flat number suggests); a run with
 * higher neighbors on BOTH sides (a genuine trough) gets a smaller nudge.
 * A literal 10 run is capped at 9.6-9.8 — true 10.0 is reserved for the
 * five destinations with real sourcing behind a global-top-5 claim, listed
 * in EXPLICIT above, never assigned by this mechanical pass.
 */
function mechanicalNudge(monthly: number[]): number[] {
  const result = [...monthly];
  for (const run of findRuns(monthly)) {
    if (run.value === 0 || !Number.isInteger(run.value)) continue; // leave 0s and existing decimals alone
    const prevVal = monthly[(run.start - 1 + 12) % 12];
    const nextVal = monthly[(run.start + run.len) % 12];
    const risesBefore = prevVal > run.value;
    const risesAfter = nextVal > run.value;
    let value: number;
    if (run.value >= 10) {
      value = run.len <= 3 ? 9.8 : 9.6; // never a bare 10 outside EXPLICIT
    } else if (risesBefore && risesAfter) {
      value = run.value + 0.15; // genuine trough, both sides better
    } else if (risesBefore || risesAfter) {
      value = run.value + 0.3; // shoulder — closer to the good season than it looks
    } else {
      value = run.value - 0.2; // flat baseline, nothing adjacent pulling it up
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

    // Reconstruct the CURRENT monthly array from the live curve (the same
    // evaluator the app uses) so the mechanical pass and the diff below are
    // computed against what's actually in production right now, not a
    // stale hand-transcribed copy.
    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const existingOverride = scoreOverridesBefore[KEY] || {};
    const scored = scorePlace(row);
    const liveWhale = scored.monthly[KEY];

    let newScores: Record<number, number>;
    let textPatch: Record<number, string> = {};

    if (EXPLICIT[id]) {
      newScores = { ...EXPLICIT[id].scores } as Record<number, number>;
      textPatch = EXPLICIT[id].text as Record<number, string>;
      // Fill in the mechanical nudge for any month NOT explicitly covered,
      // so a destination's untouched baseline months still lose their
      // suspicious roundness (e.g. Iceland's Jan-Mar, Los Cabos already
      // fully covered explicitly, Azores already fully covered).
      const afterExplicit = liveWhale.map((v, i) => (i in newScores ? newScores[i] : v));
      const nudged = mechanicalNudge(afterExplicit);
      for (let i = 0; i < 12; i++) if (!(i in newScores) && nudged[i] !== afterExplicit[i]) newScores[i] = nudged[i];
    } else {
      const nudged = mechanicalNudge(liveWhale);
      newScores = {};
      for (let i = 0; i < 12; i++) if (nudged[i] !== liveWhale[i]) newScores[i] = nudged[i];
    }

    const finalOverride: Record<number, number> = { ...existingOverride };
    let changedCount = 0;
    for (const [idxStr, val] of Object.entries(newScores)) {
      const idx = Number(idxStr);
      if (liveWhale[idx] !== val) changedCount++;
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
      if (i in newScores && liveWhale[i] !== newScores[i]) {
        console.log(`  ${MONTH_NAMES[i].padEnd(10)} ${liveWhale[i]} -> ${newScores[i]}${textPatch[i] ? '  [text updated]' : ''}`);
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
