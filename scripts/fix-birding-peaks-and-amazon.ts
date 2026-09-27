import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { parseSliderCurve, rescaleCurve } from '../src/lib/scoring/curve';

/**
 * Three birding corrections.
 *
 * 1. THE PERUVIAN AMAZON'S FLOOR DID NOT RENDER. It was authored at 7 and
 *    came out at 4.2, because seasonalHazards are a live multiplier
 *    reapplied on TOP of authored curves (mild x0.85, moderate x0.6, severe
 *    x0.3) — and a moderate "Mosquitoes & biting insects" hazard covering
 *    Dec-Apr listed `birding` among its affected sliders.
 *
 *    That is the right mechanism and the wrong application. Amazon birders
 *    wear long sleeves and DEET and go anyway; mosquitoes are a constant of
 *    Amazon birding in every month, not a December-to-April differentiator,
 *    so docking two and a half points off the low-water season for them
 *    describes nothing real. `birding` comes off that hazard's list. The
 *    hazard itself stays, and still applies to hiking, wildlife viewing,
 *    adventure sports and fishing, where sitting still in a swamp at dusk
 *    is a genuinely worse experience.
 *
 * 2 & 3. TWO SPECTACLE OUTLIERS NOTCHED DOWN. The Faroes at 9 sat above
 *    Tanzania, and the Seychelles at 8 above Kruger — on lists of roughly
 *    fifty and roughly fifty species respectively. Both are genuinely
 *    thrilling and genuinely tiny. Iceland, Antarctica, the Falklands and
 *    Churchill are deliberately NOT touched: mass spectacle is a real
 *    reason to travel for birds and over-correcting into denying that would
 *    be its own error.
 */

type Edit = { id: string; peak: number; why: string };

const PEAKS: Edit[] = [
  { id: 'faroe-islands', peak: 7, why: '~50 breeding species; a 9 put it above Tanzania' },
  { id: 'seychelles', peak: 6, why: '~50 species; superb endemics, but an 8 put it above Kruger' },
  // Three raises, argued against catalogue peers at the SAME SCOPE rather
  // than against country species lists — the mistake that produced a
  // now-withdrawn proposal to raise `thailand`, whose actual name is
  // "Thailand — Phuket & Islands" and whose scope is a southern beach
  // region, not Kaeng Krachan.
  { id: 'panama', peak: 9, why: 'Canopy Tower and the Darien; peer Costa Rica is 10' },
  { id: 'guatemala', peak: 7, why: 'was below its own neighbours Belize (7) and Nicaragua (6)' },
  { id: 'oaxaca', peak: 6, why: 'peer Chiapas is 7 — same country, same endemism band' },
];

const AMAZON = { id: 'peruvian-amazon', slider: 'birding', hazard: 'Mosquitoes & biting insects' };

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try { raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8'); } catch { return out; }
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

type Hazard = { label: string; affectedSliders: string[] };

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const scored = await getAllScoredPlaces();

  const apply = async (id: string, patch: Record<string, unknown>, label: string) => {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not a primary destination`); process.exit(1); }
    console.log(`  ${id.padEnd(20)} ${label}`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places)
          .set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() })
          .where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: id,
          action: 'update',
          beforeValue: row,
          afterValue: { ...row, ...patch },
        });
      });
    }
    byId.set(id, { ...row, ...patch } as typeof row);
  };

  // 1 — the Amazon's mosquito hazard stops applying to birding.
  const amazon = byId.get(AMAZON.id)!;
  const hazards = (amazon.seasonalHazards ?? []) as unknown as Hazard[];
  const target = hazards.find((h) => h.label === AMAZON.hazard);
  if (!target) { console.error(`${AMAZON.id}: no "${AMAZON.hazard}" hazard found`); process.exit(1); }
  if (!target.affectedSliders.includes(AMAZON.slider)) {
    console.log(`  ${AMAZON.id}: birding already off the mosquito hazard — nothing to do`);
  } else {
    const next = hazards.map((h) =>
      h.label === AMAZON.hazard ? { ...h, affectedSliders: h.affectedSliders.filter((k) => k !== AMAZON.slider) } : h);
    await apply(AMAZON.id, { seasonalHazards: next }, 'mosquito hazard no longer applies to birding (floor 7 was rendering as 4.2)');
  }

  // 2 & 3 — the spectacle notches.
  for (const e of PEAKS) {
    const row = byId.get(e.id)!;
    const monthly = scored.find((x) => x.id === e.id)!.monthly.birding ?? [];
    const was = Math.max(...monthly);
    const raw = (row.sliderCurves as Record<string, unknown>).birding;
    if (raw === undefined) { console.error(`${e.id}: no birding curve`); process.exit(1); }
    const rescaled = rescaleCurve(parseSliderCurve(raw), Math.min(Math.min(...monthly), e.peak), e.peak);
    await apply(e.id, {
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), birding: rescaled },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), 'birding'])),
    }, `birding ${was.toFixed(0)} -> ${e.peak} — ${e.why}`);
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
