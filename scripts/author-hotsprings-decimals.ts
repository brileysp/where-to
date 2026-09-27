import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Hot Springs de-flattening pass (docs/interest-content-authoring-
// playbook.md §2). Unlike whaleWatching/safari/auroraChasing, this
// catalog's flat blocks are almost all already text-matched (a flat
// score with identical text across the block is the CORRECT, honest
// case per the playbook rule) — so no blanket mechanical nudge is run
// here. Only the specific violations found in a full text/score
// consistency scan are touched:
//
//  - budapest: a real bug — November shared IDENTICAL text with March
//    ("Cold snaps are common...") but scored 10 instead of 7, tied to
//    the literal Jan/Feb/Dec peak. Also, 3 flat months at literal 10.0
//    is more than this destination's real climate supports (Jan is
//    Budapest's coldest month on average, Feb second, Dec mildest of
//    the three) — retextured with real seasonal-temperature grounding,
//    capped below 10.0.
//  - iceland: 6 straight months flat at literal 10.0, yet this
//    destination's OWN auroraChasing curve (researched this session)
//    shows real month-to-month variation for the exact same phenomenon
//    the hotSprings blurb credits ("real aurora odds on top of the
//    warm water") — Feb 9.8 (statistically clearest skies), Jan/Dec
//    9.8, Nov 9.6 (returning), Oct 8.3 (real but lighter), Mar 7.3
//    (fading). Rescaled hotSprings to track that same real shape
//    instead of treating the whole Oct-Mar window as identical.
//  - hokkaido: 4 flat months at literal 10.0. Real fact: Sapporo's
//    average snow depth peaks in February, with January close behind;
//    December is still building toward peak accumulation and March
//    is beginning to soften (especially near the coast) by month's
//    end — retextured to reflect that shape, capped below 10.0.
//  - uyuni: November shared identical "dry-season conditions" text
//    with May/Aug/Sep/Oct but scored 4 instead of 5 — no real basis
//    found (Uyuni's rainy season is officially Dec-Mar, so November is
//    still genuinely dry); unified back into the same score.
//  - atacama: December shared IDENTICAL text with Jan/Feb ("rainier
//    stretch...") but scored 4.5 instead of 3 — the decimal itself is
//    a reasonable read (December is early in the wet season, less
//    accumulated rain than Jan/Feb), it just needs its own sentence
//    instead of a copy-pasted one that claims an equivalence the score
//    doesn't have.
//  - argentine-lake-district: 7 months of "heavy snow closes the
//    access road... not a realistic time to plan a visit" — genuinely
//    closed/inaccessible language — were scored 5, the same as many
//    other destinations' perfectly fine, open baseline months
//    elsewhere in this catalog. Cross-checked against this catalog's
//    other "closed for the season" language (Greenland's "no practical
//    way to reach the spring" = 3, Kyrgyzstan's "snowed in and
//    unreachable" = 4) — rescaled down to match that severity.
//  - chilean-lake-district: April/September/October/November all share
//    the identical "Still good, quieter conditions" sentence but
//    ramped 6.5 -> 7 -> 7.01 -> 7.5, a full point of drift on one
//    unchanging sentence — flattened to one shared value.
const KEY = 'hotSprings';

interface Fix {
  scores: Partial<Record<number, number>>;
  text: Partial<Record<number, string>>;
}

const FIXES: Record<string, Fix> = {
  iceland: {
    scores: { 0: 9.7, 1: 9.8, 2: 7.3, 8: 7.4, 9: 8.3, 10: 9.6, 11: 9.7 },
    text: {
      1: 'February is statistically Iceland’s clearest-sky month, on top of the same long, dark nights and warm geothermal water.',
      2: 'The aurora window is closing fast as nights shorten, though the warm geothermal water is the same as ever.',
      8: 'Nights are just starting to get dark again, with a modest chance of aurora on top of the warm water.',
      9: 'A real, if still building, chance of aurora on a clear night, alongside the warm geothermal water as always.',
      10: 'The dark season is back in full and aurora odds are strong, on top of the warm geothermal water as always.',
      11: 'Long, dark nights give strong aurora odds on a clear night, on top of the warm geothermal water.',
    },
  },
  hokkaido: {
    scores: { 0: 9.6, 1: 9.7, 2: 8.6, 11: 9.0 },
    text: {
      0: 'Real, deep snow on the ground makes for the classic rotenburo experience — steaming outdoor baths in falling or settled snow.',
      1: 'Snow depth is usually at its yearly peak this month, the single best stretch for the classic rotenburo-in-snow scene.',
      2: 'Snow is usually still on the ground for a good rotenburo scene, though it starts thinning, especially near the coast, as the month goes on.',
      11: 'Snow is accumulating quickly, though the season’s heaviest snowfall is usually still a month or two away.',
    },
  },
  budapest: {
    scores: { 0: 9.7, 1: 9.3, 2: 7.2, 10: 7.3, 11: 9.0 },
    text: {
      0: 'January is typically Budapest’s coldest month, when Széchenyi’s outdoor pools steam most dramatically against the freezing air.',
      11: 'Cold enough on most days for dramatic steam, though early winter is usually a touch milder than deep January.',
    },
  },
  uyuni: {
    scores: { 10: 5 },
    text: {},
  },
  atacama: {
    scores: {},
    text: {
      11: 'The wet season is only just beginning here — real rain, but less accumulated than January or February.',
    },
  },
  'argentine-lake-district': {
    scores: { 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3 },
    text: {},
  },
  'chilean-lake-district': {
    scores: { 3: 7, 9: 7, 10: 7 },
    text: {},
  },
};

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

  const ids = Object.keys(FIXES);
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const scored = scorePlace(row);
    const live = scored.monthly[KEY];
    const fix = FIXES[id];

    const finalOverride: Record<number, number> = { ...(scoreOverridesBefore[KEY] || {}) };
    let changedCount = 0;
    for (const [idxStr, val] of Object.entries(fix.scores)) {
      const idx = Number(idxStr);
      if (val === undefined) continue;
      if (live[idx] !== val) changedCount++;
      finalOverride[idx] = val;
    }

    const patch: Record<string, unknown> = {
      scoreOverrides: { ...scoreOverridesBefore, [KEY]: finalOverride },
    };
    const textEntries = Object.entries(fix.text).filter(([, v]) => v !== undefined);
    if (textEntries.length > 0) {
      const mw = [...((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] || new Array(12).fill(null))];
      for (const [idxStr, text] of textEntries) mw[Number(idxStr)] = text as string;
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: mw };
    }

    console.log(`\n${row.name} (${id}) — ${changedCount} scores changed, ${textEntries.length} text updated`);
    for (const [idxStr, val] of Object.entries(fix.scores)) {
      const idx = Number(idxStr);
      if (val !== undefined && live[idx] !== val) {
        console.log(`  ${MONTH_NAMES[idx].padEnd(10)} ${live[idx]} -> ${val}${fix.text[idx] ? '  [text updated]' : ''}`);
      }
    }
    for (const [idxStr, text] of textEntries) {
      const idx = Number(idxStr);
      if (!(idx in fix.scores)) console.log(`  ${MONTH_NAMES[idx].padEnd(10)} [text only] ${text}`);
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
