import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Fifth batch — island endemism/spectacle (Madagascar, Papua New Guinea).
 * Madagascar's event label ("Dry-season access") was another instance of
 * the generic/borrowed-label pattern found repeatedly this batch —
 * relabeled to the real reason (access to its uniquely endemic bird
 * families), timing/weight unchanged. PNG runs on the generic
 * birdingPeak fallback; its dry-season timing is ecologically plausible
 * (regional highland dry season), used as-is.
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  madagascar: 'Five entire bird families found nowhere else on Earth — vangas, mesites, ground-rollers, cuckoo-rollers, and asities — the product of tens of millions of years of isolation. Around 110 species total are found only in Madagascar.',
  'papua-new-guinea': 'Extreme isolation and habitat diversity have produced dozens of birds-of-paradise species with some of the most elaborate courtship displays in the natural world, alongside deep endemism across the island\'s forest interior.',
};

const MONTHLY: Record<string, string[]> = {
  madagascar: [
    'Wet season; heavier rain limits access to the forest reserves where the endemic bird families concentrate.', // Jan
    'Wet season; heavier rain limits access to the forest reserves where the endemic bird families concentrate.', // Feb
    'Wet season; heavier rain limits access to the forest reserves where the endemic bird families concentrate.', // Mar
    'Conditions drying out; access improving.', // Apr
    'Conditions drying out; access improving.', // May
    'Dry-season conditions give the best access to forest reserves across the island.', // Jun
    'Dry-season conditions give the best access to forest reserves across the island.', // Jul
    'Dry-season conditions give the best access to forest reserves across the island.', // Aug
    'Dry-season conditions give the best access to forest reserves across the island.', // Sep
    'Conditions still good, easing slightly.', // Oct
    'Rains beginning to return.', // Nov
    'Wet season resumes, limiting access again.', // Dec
  ],
  'papua-new-guinea': [
    'Wet season; heavier rain limits access to the highland forest interior.', // Jan
    'Wet season; heavier rain limits access to the highland forest interior.', // Feb
    'Wet season; heavier rain limits access to the highland forest interior.', // Mar
    'Conditions drying out; access improving.', // Apr
    'Conditions drying out; access improving.', // May
    'Dry-season conditions give the best access to highland forest sites, where birds-of-paradise display sites are concentrated.', // Jun
    'Dry-season conditions give the best access to highland forest sites, where birds-of-paradise display sites are concentrated.', // Jul
    'Dry-season conditions give the best access to highland forest sites, where birds-of-paradise display sites are concentrated.', // Aug
    'Dry-season conditions give the best access to highland forest sites, where birds-of-paradise display sites are concentrated.', // Sep
    'Rains beginning to return.', // Oct
    'Rains beginning to return.', // Nov
    'Wet season resumes, limiting access again.', // Dec
  ],
};

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

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  // Relabel Madagascar's event.
  {
    const [row] = await db.select().from(places).where(eq(places.id, 'madagascar'));
    const existing = (row.sliderEvents as any)[KEY][0];
    const events = [{ ...existing, label: 'Dry-season access to endemic bird families' }];
    console.log(`  madagascar  "${existing.label}" -> "Dry-season access to endemic bird families"`);
    if (!dryRun) {
      const patch = { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events } };
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, 'madagascar'));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'madagascar',
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    console.log(`  ${id}: writing overview + 12 monthly entries`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
