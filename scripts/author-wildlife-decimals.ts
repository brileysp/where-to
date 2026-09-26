import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Wildlife Viewing de-flattening pass (docs/interest-content-
// authoring-playbook.md §2). At 200 destinations this is the
// largest interest in the project; an automated flagging scan (wide
// flat-10 runs, same-text score spreads, isolated cliffs) was used to
// find the highest-confidence violations rather than reading every
// destination by hand. ~90 flagged "spread 1.00 across all 12 months"
// items were generic "wildlife-watching isn't a dedicated focus here"
// baseline text on non-wildlife destinations — harmless curve-
// interpolation noise, left alone, consistent with how this session
// has treated that pattern elsewhere.
//
// Two classes of real issue were fixed:
//
// 1. Over-claimed flat-10 plateaus (11 destinations, 4-10 months each)
//    — the same pattern found in diving/beaches, at similar scale.
//    Several ALSO contained the specific bug of distinct, lesser-
//    claiming text tied to the identical peak score:
//     - svalbard: July-Sept text says polar bear odds "ease slightly
//       as the ice retreats" yet was tied to the same 10.0 as April-
//       June's "peak polar bear season" text.
//     - kenya (Maasai Mara): June/July's own text says the crossings
//       are "still on their own schedule this early in the season —
//       not yet as reliable as August" yet was tied to the identical
//       10.0 as August-October's actual peak text.
//     - costa-rica: the most extreme case in the whole project — 10
//       of 12 months flat at literal 10.0 for "sloths near-guaranteed,
//       monkeys common." Real, reliable wildlife, but nowhere near the
//       rarity of a migration, a flood pulse, or a polar bear — cut
//       to a still-strong 8-8.5 across the board.
//    Others (madagascar, zimbabwe, tanzania, galapagos, botswana,
//    peruvian-amazon, pantanal) had no internal text contradiction,
//    just plateaus wider than their real caliber supports — tapered
//    proportionally. antarctica was left alone: its "flat 10" IS the
//    entire accessible season (the other 7 months are a hard 0, ships
//    literally don't sail), which is a different case from a place
//    claiming peak-quality across an artificially wide slice of an
//    otherwise-normal year.
//
// 2. Standalone bugs:
//     - colombian-andes, ecuadorian-andes, barbados: identical text
//       repeated across all 12 months (explicitly claiming no real
//       seasonal difference — barbados's text literally says "year-
//       round") yet scores wave up and down by 2-4 points with nothing
//       in the text to justify it. Flattened to one honest value each.
//     - yellowstone, maui: March/April (Yellowstone) and March/April
//       (Maui) shared the IDENTICAL "peak season" sentence but scored
//       dramatically lower in April — gave April its own honest,
//       real-world-grounded text (elk dispersing to higher ground;
//       whales migrating back to Alaska) instead of a copy-pasted peak
//       claim it no longer earns.
//     - azores, los-cabos: shared "peak" whale text was recycled into
//       shoulder months (Azores' building/easing edges, Los Cabos'
//       April/December) that the score already correctly discounted —
//       gave those months their own honest text to match.
//     - everglades: May and November shared the identical "wetter
//       conditions disperse wildlife" text used for the deep wet-
//       season low (Jun-Sep, scored 1.5) despite being real, distinct
//       transition months (dry season just ending / dry season
//       approaching) that the underlying curve already scored much
//       higher (3.9 and 6.5) — gave each its own transition-specific
//       text.
//     - peruvian-amazon: April and May shared the IDENTICAL "river
//       levels beginning to drop" sentence but scored 4.8 vs 8, a 3.2-
//       point jump with no textual distinction — split into two real
//       stages of the same drawdown.
const KEY = 'wildlifeViewing';

interface Fix {
  scores: Partial<Record<number, number>>;
  text?: Partial<Record<number, string>>;
}

const FIXES: Record<string, Fix> = {
  madagascar: { scores: { 4: 9.5, 5: 9.5, 6: 9.5, 7: 9.5, 8: 9.5, 9: 9.5 } },
  'costa-rica': {
    scores: { 0: 8.5, 1: 8.5, 2: 8.5, 3: 8.5, 4: 8.5, 5: 8.5, 6: 8.5, 7: 8.5, 8: 8, 9: 8, 10: 8.5, 11: 8.5 },
  },
  zimbabwe: { scores: { 6: 9.5, 7: 9.5, 8: 9.5, 9: 9.5 } },
  tanzania: { scores: { 0: 9.5, 1: 9.5, 2: 9.5, 5: 9.6, 6: 9.6, 7: 9.6, 8: 9.6, 9: 9.6 } },
  svalbard: { scores: { 3: 9.7, 4: 9.7, 5: 9.7, 6: 9.3, 7: 9.3, 8: 9.3 } },
  kenya: { scores: { 5: 9, 6: 9.4, 7: 9.7, 8: 9.7, 9: 9.7 } },
  galapagos: { scores: { 4: 9.6, 5: 9.6, 6: 9.6, 7: 9.6, 8: 9.6, 9: 9.6, 10: 9.6, 11: 9.6 } },
  botswana: { scores: { 5: 9.6, 6: 9.6, 7: 9.6, 8: 9.6, 9: 9.6 } },
  pantanal: { scores: { 6: 9.7, 7: 9.7, 8: 9.7, 9: 9.7 } },
  'peruvian-amazon': {
    scores: { 3: 5.5, 4: 7.5, 5: 9.3, 6: 9.3, 7: 9.3, 8: 9.3 },
    text: {
      3: 'River levels are just beginning to drop; conditions are still similar to the wetter months.',
      4: 'River levels are dropping quickly now, concentrating wildlife along the banks as the dry season approaches.',
    },
  },
  'colombian-andes': { scores: { 0: 6, 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6 } },
  'ecuadorian-andes': { scores: { 0: 6, 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6 } },
  barbados: { scores: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 5, 10: 5, 11: 5 } },
  yellowstone: {
    scores: { 3: 6.5 },
    text: { 3: 'Snow is melting fast and elk are dispersing to higher ground, making wolf sightings noticeably harder than the winter peak.' },
  },
  maui: {
    scores: { 3: 4.5 },
    text: { 3: 'Whale numbers are dropping quickly as the migration back to Alaska begins.' },
  },
  azores: {
    scores: { 5: 6 },
    text: {
      2: 'Whale migration is beginning; sightings are building toward peak.',
      5: 'Whale migration is easing as the season winds down.',
    },
  },
  'los-cabos': {
    scores: {},
    text: {
      3: 'Gray whale season is ending; sightings are tapering off.',
      11: 'Gray whale season is just beginning; the first arrivals are being seen.',
    },
  },
  everglades: {
    scores: { 4: 4, 10: 5.5 },
    text: {
      4: 'The dry season is ending; alligator concentrations are starting to disperse as wetter conditions return.',
      10: 'The dry season is approaching; water levels are dropping and alligators are beginning to concentrate again.',
    },
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
    const textEntries = Object.entries(fix.text ?? {}).filter(([, v]) => v !== undefined);
    if (textEntries.length > 0) {
      const mw = [...((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] || new Array(12).fill(null))];
      for (const [idxStr, text] of textEntries) mw[Number(idxStr)] = text as string;
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: mw };
    }

    console.log(`\n${row.name} (${id}) — ${changedCount} scores changed, ${textEntries.length} text updated`);
    for (const [idxStr, val] of Object.entries(fix.scores)) {
      const idx = Number(idxStr);
      if (val !== undefined && live[idx] !== val) {
        console.log(`  ${MONTH_NAMES[idx].padEnd(10)} ${live[idx]} -> ${val}${fix.text?.[idx] ? '  [text updated]' : ''}`);
      }
    }
    for (const [idxStr, text] of textEntries) {
      const idx = Number(idxStr);
      if (!(idx in fix.scores) || fix.scores[idx] === undefined) console.log(`  ${MONTH_NAMES[idx].padEnd(10)} [text only] ${text}`);
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
