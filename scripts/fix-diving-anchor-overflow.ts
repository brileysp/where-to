import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'diving';

// db:audit:anchors flagged 8 destinations peaking at 10 while not being in
// diving's 10-place anchor set. 5 of these (palawan, seychelles, okinawa,
// thailand, papua-new-guinea) already had that overflow BEFORE this
// session's fixes — a pre-existing gap, not something introduced here. 3
// (mauritius, bahamas, turks-caicos) are new, introduced by today's event
// additions. Rather than hand-retuning 8 different event curves, capping
// at 9 via sliderCaps is the same mechanism already used elsewhere in this
// codebase for exactly this situation (see the wildlifeViewing precedent
// noted in destinations.ts). Whether palawan (Tubbataha), seychelles, or
// papua-new-guinea genuinely deserve anchor-list promotion is a judgment
// call left to the user, not decided here — capping is the safe default
// that keeps the audit clean either way.

const IDS = ['turks-caicos', 'palawan', 'seychelles', 'okinawa', 'mauritius', 'thailand', 'papua-new-guinea', 'bahamas'];

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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of IDS) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const patch = { sliderCaps: { ...(row.sliderCaps as Record<string, number>), [KEY]: 9 } };
    console.log(`${id}: sliderCaps.diving = 9`);
    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
