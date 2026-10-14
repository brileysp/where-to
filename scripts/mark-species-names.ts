// Marks species names in already-authored blurbs with ** so the public card can show them in a heavier weight.
// No AI: it uses the fixed word list in src/lib/text/species-marker.ts. Every result is checked to be identical
// to the original once the markers are removed.
//
// Step 1 (writes only a JSON file, and prints a report):  npx tsx scripts/mark-species-names.ts --interest=safari --out=/tmp/marked.json
// Step 2 (writes to places):                              npx tsx scripts/mark-species-names.ts --interest=safari --out=/tmp/marked.json --apply
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places } from '../src/lib/db/schema';
import { parseCliArgs, getString } from '../src/lib/gemini/cli';
import { stripEmphasis } from '../src/lib/text/emphasis';
import { markSpecies } from '../src/lib/text/species-marker';

const env: Record<string, string> = {};
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
  if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = env[m[1].trim()];
}

// Words that look like animals but are left unmarked on purpose (groups or unclear), printed so a human can overrule.
const WATCH = /\b(monkeys?|baboons?|antelopes?|gazelles?|primates?|big cats?|cats?|predators?|raptors?|birds?|caimans?|bears?|otters?|deer|wolves|foxes|crocodiles?|zebras?|rhinos?|orangutans?|hyenas?|dogs?)\b/gi;

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const interest = getString(args, 'interest') ?? 'safari';
  const outPath = getString(args, 'out') ?? '/tmp/marked.json';
  const apply = process.argv.includes('--apply');
  const db = drizzle(postgres(env.DATABASE_URL, { prepare: false }));

  if (apply) {
    const marked = JSON.parse(readFileSync(outPath, 'utf8')) as Record<string, { overview: string; months: string[] }>;
    const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
    const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
    const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
    for (const [id, m] of Object.entries(marked)) {
      const [r] = await db.select().from(places).where(eq(places.id, id));
      if (!r) continue;
      const ov = { ...((r.sliderOverview as Record<string, string>) ?? {}) };
      const mo = { ...((r.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {}) };
      if (stripEmphasis(ov[interest] ?? '') !== stripEmphasis(m.overview) || m.months.some((t, i) => stripEmphasis(mo[interest]?.[i] ?? '') !== stripEmphasis(t))) { console.log('SKIP (text changed since marking):', id); continue; }
      ov[interest] = m.overview;
      mo[interest] = m.months;
      const base = { entityType: 'destination', entityId: id, loadedUpdatedAt: r.updatedAt.toISOString() };
      patches.push({ ...base, field: 'sliderOverview', value: ov }, { ...base, field: 'sliderMonthlyWeather', value: mo });
    }
    const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
    console.log('patches', patches.length, 'saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
    process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
  }

  const rows = await db.select().from(places);
  // Place words: every word in a place name, region or search term, so "Uganda's" is never read as part of a species name.
  const placeWords = new Set<string>();
  for (const r of rows) for (const s of [r.name, r.region, ...(r.searchAliases ?? [])]) for (const w of String(s ?? '').toLowerCase().split(/[^a-zà-ÿ]+/)) if (w.length > 2) placeWords.add(w);
  const out: Record<string, { overview: string; months: string[] }> = {};
  const marked = new Map<string, number>();
  const left = new Map<string, number>();
  for (const r of rows) {
    const ov = (r.sliderOverview as Record<string, string>)?.[interest];
    const mo = (r.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[interest];
    if (!ov || !mo) continue;
    const m = { overview: markSpecies(ov, { placeWords }), months: mo.map((t) => markSpecies(t ?? '', { placeWords })) };
    if (stripEmphasis(m.overview) !== stripEmphasis(ov) || m.months.some((t, i) => stripEmphasis(t) !== stripEmphasis(mo[i] ?? ''))) throw new Error(`${r.id}: wording changed`);
    out[r.id] = m;
    for (const t of [m.overview, ...m.months]) {
      for (const x of t.matchAll(/\*\*([^*]+)\*\*/g)) marked.set(x[1].toLowerCase(), (marked.get(x[1].toLowerCase()) ?? 0) + 1);
      for (const x of t.replace(/\*\*[^*]+\*\*/g, ' ').matchAll(WATCH)) left.set(x[0].toLowerCase(), (left.get(x[0].toLowerCase()) ?? 0) + 1);
    }
  }
  writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log(`Marked ${Object.keys(out).length} places. Written to ${outPath}\n\nMARKED:`);
  console.log([...marked.entries()].sort().map(([n, c]) => `  ${n} (${c})`).join('\n'));
  console.log('\nLEFT UNMARKED (animal-like words outside any marked name):');
  console.log([...left.entries()].sort().map(([n, c]) => `  ${n} (${c})`).join('\n'));
  process.exit(0);
}
main();
