// Wording-only fixes (19 Oct 2026) for texts that still name a place's OLD, narrower scope but are otherwise right for the wider place
// (see docs/renamed-places.json). Exact, case-sensitive replacements through the audited admin edit path; each must change something.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/scope-name-fixes-oct19.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { inArray } from 'drizzle-orm';
import { places } from '../src/lib/db/schema';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
type Fix = { place: string; interest: string; from: string; to: string };
const FIXES: Fix[] = [
  { place: 'havana', interest: 'beachesSwimming', from: "Havana's water is warm year-round", to: "Cuba's water is warm year-round" },
  { place: 'borabora', interest: 'beachesSwimming', from: "Bora Bora's lagoon stays warm", to: "French Polynesia's lagoons stay warm" },
  { place: 'punta-cana', interest: 'beachesSwimming', from: "Punta Cana's water is warm year-round", to: "The Dominican Republic's water is warm year-round" },
  { place: 'banff', interest: 'auroraChasing', from: 'Banff sees the aurora several times a season', to: 'Banff and Jasper see the aurora several times a season' },
  { place: 'banff', interest: 'auroraChasing', from: 'Full dark season at Banff', to: 'Full dark season in the parks' },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const db = drizzle(postgres(process.env.DATABASE_URL as string, { prepare: false, max: 2 }));
  const rows = await db.select().from(places).where(inArray(places.id, [...new Set(FIXES.map((f) => f.place))]));
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  for (const r of rows) {
    const ov = { ...((r.sliderOverview as Record<string, string>) ?? {}) };
    const mo = { ...((r.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {}) };
    let changed = 0;
    for (const f of FIXES.filter((x) => x.place === r.id)) {
      let hit = 0;
      if (ov[f.interest]?.includes(f.from)) { ov[f.interest] = ov[f.interest].replace(f.from, f.to); hit++; }
      if (mo[f.interest]) mo[f.interest] = mo[f.interest].map((t) => (t && t.includes(f.from) ? (hit++, t.replace(f.from, f.to)) : t));
      if (!hit) throw new Error(`${f.place}/${f.interest}: "${f.from}" not found`);
      console.log(`${f.place}/${f.interest}: ${hit} text(s): "${f.from}" -> "${f.to}"`);
      changed += hit;
    }
    if (!changed) continue;
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    patches.push({ ...base, field: 'sliderOverview', value: ov }, { ...base, field: 'sliderMonthlyWeather', value: mo });
  }
  if (!apply) { console.log('dry run'); process.exit(0); }
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('patches', patches.length, 'saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})();
