import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Shared runner for the mountaineering authoring batches. Each batch file
// supplies ENTRIES (overview + 12 {score, text} months, scores are decimals
// derived from the text) and calls runBatch. Before touching the DB it
// self-checks every entry against the playbook §1 Step 6 rules that can be
// verified mechanically: identical text must carry (nearly) the same score,
// and no more than 4 months may sit at the literal 10.
export const KEY = 'mountaineering';

export interface Month { score: number; text: string }
export interface Entry { overview: string; months: Month[] }

export const m = (score: number, text: string): Month => ({ score, text });

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

function selfCheck(id: string, e: Entry): string[] {
  const problems: string[] = [];
  if (e.months.length !== 12) problems.push(`${id}: months is not length 12`);
  const byText = new Map<string, number[]>();
  e.months.forEach((mo, i) => {
    if (!byText.has(mo.text)) byText.set(mo.text, []);
    byText.get(mo.text)!.push(i);
    if (mo.score < 0 || mo.score > 10) problems.push(`${id}: ${MONTH_NAMES[i]} score ${mo.score} out of range`);
  });
  for (const [text, idxs] of byText) {
    const vals = idxs.map((i) => e.months[i].score);
    if (Math.max(...vals) - Math.min(...vals) > 0.3) {
      problems.push(`${id}: identical text but scores differ (${idxs.map((i) => `${MONTH_NAMES[i]}=${e.months[i].score}`).join(', ')}): "${text.slice(0, 50)}"`);
    }
  }
  const tens = e.months.filter((mo) => mo.score >= 9.95).length;
  if (tens > 4) problems.push(`${id}: ${tens} months at the literal cap`);
  return problems;
}

export async function runBatch(entries: Record<string, Entry>, opts: { clearNA?: string[] } = {}) {
  const problems = Object.entries(entries).flatMap(([id, e]) => selfCheck(id, e));
  if (problems.length) {
    console.error('Self-check failed:\n' + problems.map((p) => '  - ' + p).join('\n'));
    process.exit(1);
  }

  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(entries)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const entry = entries[id];

    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const live = scorePlace(row).monthly[KEY];
    const override: Record<number, number> = {};
    entry.months.forEach((mo, i) => { override[i] = mo.score; });

    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: entry.overview },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: entry.months.map((mo) => mo.text) },
      scoreOverrides: { ...scoreOverridesBefore, [KEY]: override },
    };

    const naBefore = ((row as unknown as { naSliders?: string[] }).naSliders ?? []) as string[];
    if (opts.clearNA?.includes(id) && naBefore.includes(KEY)) {
      patch.naSliders = naBefore.filter((k) => k !== KEY);
      console.log(`  (clearing ${KEY} from naSliders)`);
    }

    console.log(`\n${row.name} (${id})`);
    entry.months.forEach((mo, i) => console.log(`  ${MONTH_NAMES[i].padEnd(10)} ${String(live[i]).padEnd(6)} -> ${mo.score}`));

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

  console.log(dryRun ? '\n\ndry run — nothing written.' : '\n\ndone — written to sliderOverview / sliderMonthlyWeather / scoreOverrides.');
  process.exit(0);
}
