import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Snapshots the ranking a brand-new visitor sees — no persona, no weights,
 * no bands (ResultsApp starts at `weights = {}`), which routes through
 * scoreForMonth's `tw === 0` default-appeal branch. Ranked by each
 * destination's BEST month: the product always scores a specific month,
 * so this asks "at its best, how strong a general recommendation is this
 * place?" rather than averaging a park's summer against its snowbound
 * January.
 *
 * This is a MEASUREMENT, not a spec: it records what the algorithm does,
 * never what it should do. Expected-ranking assertions belong in a
 * hand-authored file that is never regenerated from this output — a
 * baseline refreshed from its own result can't detect its own regressions.
 *
 * Snapshots are dated and kept, so consecutive runs can be diffed: content
 * authoring moves these numbers constantly (the 178-destination
 * mountainBiking/kayakingRafting pass moved them the day this was written),
 * so "what shifted since last time, and did we mean to?" is the question
 * this exists to answer.
 */

const SNAPSHOT_DIR = join(__dirname, '..', 'docs', 'rankings');

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

interface SnapshotEntry {
  rank: number;
  id: string;
  name: string;
  region: string;
  avgScore: number;
  bestMonth: number;
  bestMonthScore: number;
  worstMonthScore: number;
}

interface Snapshot {
  generatedAt: string;
  destinationCount: number;
  description: string;
  entries: SnapshotEntry[];
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  // db/client.ts reads process.env at module load, so this must be set
  // before the dynamic imports below.
  process.env.DATABASE_URL = env.DATABASE_URL;

  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { scoreForMonth } = await import('../src/lib/scoring/rank');
  const { allBandsSelected } = await import('../src/lib/scoring/constants');

  const destinations = await getAllScoredPlaces();
  // Must match ResultsApp's own default. bandPenalty treats an EMPTY band
  // selection as "nothing matches" (0.5 per dimension = 0.0625 overall),
  // not as "no preference" — only a full selection is read as unconstrained.
  const bands = allBandsSelected();

  const entries: SnapshotEntry[] = destinations
    .map((d) => {
      const monthly = Array.from({ length: 12 }, (_, m) => scoreForMonth(d, {}, m, bands));
      const avgScore = monthly.reduce((a, b) => a + b, 0) / 12;
      const bestMonthScore = Math.max(...monthly);
      return {
        rank: 0,
        id: d.id,
        name: d.name,
        region: d.region,
        avgScore: Number(avgScore.toFixed(4)),
        bestMonth: monthly.indexOf(bestMonthScore) + 1,
        bestMonthScore: Number(bestMonthScore.toFixed(4)),
        worstMonthScore: Number(Math.min(...monthly).toFixed(4)),
      };
    })
    .sort((a, b) => b.bestMonthScore - a.bestMonthScore)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    destinationCount: entries.length,
    description: 'Default (no-persona, no-weights) ranking, scored at each destination\'s best month. The app never renders an all-months view (ResultsApp returns [] until a month is chosen), so a 12-month average would measure something the product does not do — and would penalise seasonal destinations for their off-season.',
    entries,
  };

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const outPath = join(SNAPSHOT_DIR, `default-ranking-${date}.json`);

  // Diff against the most recent PRIOR snapshot before writing this one.
  const prior = existsSync(SNAPSHOT_DIR)
    ? readdirSync(SNAPSHOT_DIR)
        .filter((f) => f.startsWith('default-ranking-') && f.endsWith('.json') && f !== `default-ranking-${date}.json`)
        .sort()
        .pop()
    : undefined;

  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  const spread = entries[0].bestMonthScore - entries[entries.length - 1].bestMonthScore;
  console.log(`\n=== Default ranking — ${entries.length} destinations ===`);
  console.log(`score range: ${entries[entries.length - 1].bestMonthScore.toFixed(2)} … ${entries[0].bestMonthScore.toFixed(2)}  (spread ${spread.toFixed(2)})\n`);

  console.log('TOP 25');
  for (const e of entries.slice(0, 25)) {
    console.log(`  ${String(e.rank).padStart(3)}. ${e.bestMonthScore.toFixed(2).padStart(5)}  ${e.name.padEnd(34)} ${e.region}`);
  }
  console.log('\nBOTTOM 25');
  for (const e of entries.slice(-25)) {
    console.log(`  ${String(e.rank).padStart(3)}. ${e.bestMonthScore.toFixed(2).padStart(5)}  ${e.name.padEnd(34)} ${e.region}`);
  }

  if (prior) {
    const priorSnap: Snapshot = JSON.parse(readFileSync(join(SNAPSHOT_DIR, prior), 'utf8'));
    const priorRank = new Map(priorSnap.entries.map((e) => [e.id, e.rank]));
    const movers = entries
      .filter((e) => priorRank.has(e.id))
      .map((e) => ({ ...e, delta: priorRank.get(e.id)! - e.rank }))
      .filter((e) => e.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 20);
    console.log(`\n=== Biggest movers vs. ${prior} ===`);
    if (movers.length === 0) console.log('  (no rank changes)');
    for (const m of movers) {
      console.log(`  ${m.delta > 0 ? '▲' : '▼'}${String(Math.abs(m.delta)).padStart(3)}  now #${String(m.rank).padStart(3)}  ${m.name}`);
    }
  } else {
    console.log('\n(no prior snapshot — this is the first baseline)');
  }

  console.log(`\nwrote ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
