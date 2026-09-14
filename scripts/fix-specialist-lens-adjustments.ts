import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Prompted by the user asking what a serious whale-watching enthusiast
 * (not a casual tourist) would say about the whaleWatching "10"s —
 * researched two flagged concerns properly rather than accepting or
 * dismissing them on instinct.
 *
 * Sri Lanka: confirmed, well-documented, ongoing — 10-25 boats have
 * been observed chasing a single blue whale off Mirissa, weak
 * regulatory enforcement (Sunday Times, IWC Whale Watching Handbook,
 * Mongabay/WDC commentary), and a separate serious ship-strike problem.
 * Notably worse than gold-standard destinations like Kaikoura or the
 * Azores (both cap simultaneous boats at 3). Weight cut so the peak
 * drops from 10 to 8 — the species claim (blue whales, reliably) is
 * still real, but "reliable, close, world-class" doesn't hold at the
 * level the rest of this anchor list does.
 *
 * Iceland: partially confirmed. Sighting-rate claims (~97%) are real
 * but self-reported by operators, and — more substantively — a
 * peer-reviewed NAMMCO study found Iceland's sightings skew heavily
 * toward minke whales, which serious enthusiasts regard as a lesser
 * encounter than blue/humpback (brief surface-and-dive vs. breaching);
 * blue whales are genuinely rare there. Weight cut so peak drops from
 * 10 to 9 — still strong and real, not in the same tier concern as
 * Sri Lanka.
 *
 * Cape Town: kept at 10 — the land-based southern right whale viewing
 * is genuinely excellent and the season is real. But the research
 * surfaced a concrete, worth-noting fact: South Africa's southern
 * right whale numbers have measurably declined since ~2009-2010
 * (Mammal Research Institute Whale Unit, Mongabay/WWF coverage) —
 * added as an honest caveat in the overview text, no score change.
 */

const KEY = 'whaleWatching';

async function main() {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  const env: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const FIXES: Record<string, { weight: number; label: string }> = {
    srilanka: { weight: 1, label: 'Blue whale season off the south coast (boat crowding is a documented, ongoing issue)' },
    iceland: { weight: 1, label: 'Whale season (mostly minke; blue and humpback are less reliable)' },
  };

  for (const [id, fix] of Object.entries(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    const scoring = toScoringPlace(row);
    const oldEvents = (scoring.sliderEvents?.[KEY] ?? []) as Array<{ label: string; weight: number; months: Record<number, number> }>;
    const newEvents = oldEvents.map((e) => ({ ...e, label: fix.label, weight: fix.weight }));
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: newEvents } };
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
    console.log(`  ${id}  base=${scoring.base[KEY]}  peak=${Math.max(...monthly[KEY]).toFixed(1)}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: newEvents },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? 'dry run' : 'done');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
