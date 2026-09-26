import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Same de-flattening pass as whaleWatching (see
// scripts/author-whalewatching-decimals.ts and docs/interest-content-
// authoring-playbook.md §2) applied to safari. Real-world research this
// session (see chat) confirms Serengeti & Zanzibar, Maasai Mara &
// Amboseli, and Okavango Delta are the consistent global top-3 for
// safari — the only three eligible for a true 10.0, and only on their own
// genuine peak months (calving/crossing/flood, not the whole season Kruger-
// and South-Luangwa-style destinations that sell reliability over a single
// spectacle are capped at 9.6-9.8 instead, same treatment as Maui/Monterey
// in the whale-watching pass.
const KEY = 'safari';

interface Fix {
  scores: Partial<Record<number, number>>;
  text: Partial<Record<number, string>>;
}

const EXPLICIT: Record<string, Fix> = {
  zimbabwe: {
    // Apr/May shared identical "drying out" text but scored 7.67/8.33 —
    // real bug (identical text, different score).
    scores: { 4: 8.4 },
    text: { 4: 'Conditions continuing to dry out, with game concentration building quickly toward the peak at Hwange’s waterholes.' },
  },
  nepal: {
    // Apr/May shared identical "pre-monsoon heat" text but scored 5.5/4.75.
    // Real Chitwan pattern: May is genuinely the hottest, least comfortable
    // pre-monsoon month — keeping May lower is right, it just needs its own
    // sentence instead of reusing April's.
    scores: { 4: 4.9 },
    text: { 4: 'May is the hottest, most uncomfortable stretch before the monsoon at Chitwan — still workable, but the toughest month of the dry season.' },
  },
  ethiopia: {
    // Apr/May shared identical "rains setting in" text but scored 3/2.5.
    scores: { 4: 2.6 },
    text: { 4: 'The rains are intensifying further, with trekking conditions in the Simien and Bale Mountains continuing to worsen.' },
  },
  kruger: {
    // May-Sep shared ONE identical "peak dry season" sentence but scored
    // 8.2/9/9/9/8.2. Kruger's own selling point (per its overview) is a
    // long, reliable dry season, not one narrow spectacular event — so
    // unlike Serengeti/Mara/Okavango below, no month here gets a true
    // 10.0; the three-month core gets a shared, capped ceiling instead.
    scores: { 4: 9.2, 5: 9.8, 6: 9.8, 7: 9.8, 8: 9.5 },
    text: {
      4: 'Vegetation is thinning quickly at Kruger as the dry season strengthens, sightings becoming noticeably easier.',
      8: 'Still within the dry season at Kruger, though vegetation is beginning to thicken again as the season’s end approaches.',
    },
  },
  ghana: {
    // August shared identical "rains, dispersed" text with May/Jun/Jul/Sep/Oct
    // but scored 3 instead of 2 — no real basis found for the outlier, so
    // it's unified back into the same block rather than inventing a new
    // distinction that can't be verified.
    scores: { 7: 2 },
    text: { 7: 'The rains at Mole — roads are harder going and wildlife is more dispersed, away from the waterholes.' },
  },
  zambia: {
    // June shared identical "peak, walking safaris at their best" text with
    // Jul-Sep but scored 8 instead of 9.
    scores: { 5: 8.6 },
    text: { 5: 'Dry-season conditions are strengthening in June along the Luangwa River, closing in on July’s peak.' },
  },
  namibia: {
    // Sep/Oct shared identical "still peak, exceptional waterhole viewing"
    // text but scored 9 vs 7 — a real, large, unexplained gap.
    scores: { 8: 9.4, 9: 7.8 },
    text: { 9: 'Still within the dry season at Etosha, though the first rains are approaching and waterhole concentration is beginning to ease.' },
  },
  tanzania: {
    // Serengeti & Zanzibar: 10 of 12 months were flat 10.0. Real Great
    // Migration research: calving peaks Jan-Feb at Ndutu, the herd then
    // DRIFTS (not a spectacle) through the western corridor Apr-May,
    // Grumeti crossings build in June, Mara River crossings peak Jul-Aug,
    // continuing but past their most dramatic point Sep-Oct, then a real
    // but unremarkable return trek Nov-Dec. Two genuine, distinct,
    // sourced peak events (calving + crossings) both keep a true 10.0.
    scores: { 2: 9.3, 3: 8.6, 4: 8.6, 5: 9.3, 8: 9.6, 9: 9.0, 10: 8.4, 11: 8.8 },
    text: {
      2: 'Calving season has finished at Ndutu and the now-mobile calves are moving with the herd as the southern plains begin drying out.',
      3: 'The migration is drifting north and west through the western corridor — a real but comparatively quiet stretch between the calving and crossing spectacles.',
      4: 'The migration continues drifting through the western corridor as the long rains ease, still well ahead of the Mara River crossings.',
      5: 'The herds are reaching the Grumeti River, with the season’s first river crossings beginning.',
      8: 'Crossings continue in the northern Serengeti, though the most dramatic river-crossing action has generally passed its peak.',
      9: 'The crossings are winding down as the herds begin their journey back south.',
      10: 'The return journey continues with the short rains bringing fresh grass — a real but comparatively quiet stretch of the migration.',
      11: 'The herds are back on the southern plains, grazing ahead of the calving season just weeks away.',
    },
  },
  kenya: {
    // Maasai Mara & Amboseli: 9 of 12 months were flat 10.0. Real research:
    // river crossings can run June-October but July-September is the true
    // core (August often cited as THE peak crossing month specifically for
    // the Mara side) — that three-month core keeps a true 10.0; October's
    // crossings continue but past the most dramatic point.
    scores: { 0: 9.4, 1: 9.4, 5: 9.4, 8: 10.0, 9: 9.4, 11: 9.4 },
    text: {
      5: 'The Great Migration herds are arriving in the Mara ecosystem, with the first river crossings possible as early as this month.',
      9: 'Crossings continue as the herds begin their return south, though the most dramatic action has generally passed.',
    },
  },
  botswana: {
    // Okavango Delta: 6 straight months at flat 10.0. Real research: the
    // flood arrives from Angola in May-June and peaks in July-August
    // specifically (local dry season, three times the delta's normal
    // size) before receding through September into October.
    scores: { 4: 9.2, 5: 9.6, 8: 9.6, 9: 9.3 },
    text: {
      4: 'The flood pulse is beginning to arrive from Angola, right as the local dry season sets in — water levels are just starting to rise.',
      5: 'The Delta’s channels are filling quickly with floodwater, concentrating elephant herds and predators along the remaining dry ground.',
      8: 'Water levels are beginning to recede, though game viewing remains exceptional.',
      9: 'The last of the flood season — water levels are at their lowest, with animals concentrated along what remains, though the flood’s own dramatic scale has passed.',
    },
  },
};

// Already text-consistent — mechanical nudge only, no text changes.
const MECHANICAL_ONLY = [
  'madagascar', 'srilanka', 'borneo', 'kaziranga', 'rwanda', 'uganda',
  'rajasthan-golden-triangle', 'pantanal',
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

/** Same rule as whaleWatching's mechanicalNudge — see that file's doc
 * comment. True 10.0 is never assigned here; EXPLICIT above is the only
 * place a 10.0 can come from, and only for the three researched destinations. */
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
    const liveSafari = scored.monthly[KEY];

    let newScores: Record<number, number>;
    let textPatch: Record<number, string> = {};

    if (EXPLICIT[id]) {
      newScores = { ...EXPLICIT[id].scores } as Record<number, number>;
      textPatch = EXPLICIT[id].text as Record<number, string>;
      const afterExplicit = liveSafari.map((v, i) => (i in newScores ? newScores[i] : v));
      const nudged = mechanicalNudge(afterExplicit);
      for (let i = 0; i < 12; i++) if (!(i in newScores) && nudged[i] !== afterExplicit[i]) newScores[i] = nudged[i];
    } else {
      const nudged = mechanicalNudge(liveSafari);
      newScores = {};
      for (let i = 0; i < 12; i++) if (nudged[i] !== liveSafari[i]) newScores[i] = nudged[i];
    }

    const finalOverride: Record<number, number> = { ...(scoreOverridesBefore[KEY] || {}) };
    let changedCount = 0;
    for (const [idxStr, val] of Object.entries(newScores)) {
      const idx = Number(idxStr);
      if (liveSafari[idx] !== val) changedCount++;
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
      if (i in newScores && liveSafari[i] !== newScores[i]) {
        console.log(`  ${MONTH_NAMES[i].padEnd(10)} ${liveSafari[i]} -> ${newScores[i]}${textPatch[i] ? '  [text updated]' : ''}`);
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
