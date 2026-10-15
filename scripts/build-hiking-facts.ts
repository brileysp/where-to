// Builds docs/hiking-facts.json (the notes sent to Gemini) from the hiking columns in the database and scripts/data/hiking-scopes.json, so anything
// edited on the interest page flows into the next run. The two ratings are left out on purpose: Gemini writes them, and sending ours would anchor it.
// The columns are empty until the fill pass (13 Oct 2026), so most places get no notes yet; renamed places still get their one-line scope.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/build-hiking-facts.ts
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const defs = factDefsFor('hiking');
  const label = (key: string, v: unknown) => defs.find((d) => d.key === key)?.options?.find((o) => o.value === v)?.label ?? String(v);
  const nameOf = new Map((await db.select({ id: places.id, name: places.name }).from(places)).map((p) => [p.id, p.name]));
  const stored = new Map((await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'hiking'))).map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'hiking-scopes.json'), 'utf8')) as Record<string, string>;
  const AVOID = ['Naming tour companies, guides, outfitters or hotels.', 'Describing climbing with ropes, running, mountain biking, horseback riding, city walking tours or beach strolls.'];
  const out: Record<string, unknown> = { _note: 'Hiking notes (Oct 2026), built by scripts/build-hiking-facts.ts from the hiking columns on the interest page; first drafts, only partly checked against web sources. Passed to Gemini as ground truth.' };
  for (const id of new Set([...stored.keys(), ...Object.keys(scopes)])) {
    const r = stored.get(id) ?? {};
    const facts: string[] = ['These notes are first drafts: some were checked against web sources and some were not. Use what you are sure of and leave out anything you doubt.'];
    if (r.topTrails) facts.push(`Signature trails, as Route (type, length, difficulty, months): ${r.topTrails}.`);
    if (Array.isArray(r.ways) && r.ways.length) facts.push(`What a visitor can do: ${r.ways.map((w) => label('ways', w)).join(', ')}.`);
    if (r.season) facts.push(`Walking season: ${r.season}.`);
    if (r.altitude) facts.push(`Altitude of the walking most visitors do: ${label('altitude', r.altitude)}.`);
    if (r.permits) facts.push(`Permits, fees or guide rules: ${r.permits}.`);
    if (Array.isArray(r.howReach) && r.howReach.length) facts.push(`How visitors reach the best walking: ${r.howReach.map((w) => label('howReach', w)).join(', ')}.`);
    // Crowding is an impartial count of documented indicators (hiking/v4): 5 must be mentioned, 4 only in peak-crowd months, 3 or fewer never.
    if (Array.isArray(r.crowdIndicators)) {
      const n = r.crowdIndicators.length;
      const level = ['quiet', 'quiet', 'middling', 'busy', 'very busy', 'crowded'][n];
      const rule = n === 5 ? 'You must mention crowds, in the overview and in the months where crowds peak.' : n === 4 ? 'You may mention crowds in the month blurbs for peak-crowd months, never in the overview.' : 'Do not mention crowds anywhere.';
      facts.push(`Crowding: ${n} of 5 documented indicators (${level}). ${rule}${n >= 4 && r.crowdEvidence ? ` Evidence: ${r.crowdEvidence}` : ''}`);
    }
    if (r.hazards) facts.push(`Main hazards: ${r.hazards}.`);
    // Notes typed on the interest page (scope, must-mention, extra avoid) win over the scope file.
    const notes = r as { scopeNote?: string; mustMention?: string[]; extraAvoid?: string[] };
    out[id] = { forPlaceName: nameOf.get(id) ?? '', scope: notes.scopeNote || scopes[id] || '', facts: facts.length > 1 ? facts : [], avoid: [...AVOID, ...(notes.extraAvoid ?? [])], season: '', mustMention: notes.mustMention ?? [] };
  }
  writeFileSync(join(__dirname, '..', 'docs', 'hiking-facts.json'), JSON.stringify(out, null, 1));
  console.log(`Wrote ${Object.keys(out).length - 1} fact sheets.`);
  process.exit(0);
})();
