// Builds docs/surfing-facts.json (the notes sent to Gemini) from the surfing columns in the database, so anything edited on the
// interest page flows into the next run. The ratings are left out on purpose: Gemini writes them, and sending ours would anchor it.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/build-surfing-facts.ts
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
  const defs = factDefsFor('surfing');
  const label = (key: string, v: unknown) => defs.find((d) => d.key === key)?.options?.find((o) => o.value === v)?.label ?? String(v);
  const nameOf = new Map((await db.select({ id: places.id, name: places.name }).from(places)).map((p) => [p.id, p.name]));
  const stored = new Map((await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'surfing'))).map((r) => [r.placeId, r.facts as Record<string, unknown>]));
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'surfing-scopes.json'), 'utf8')) as Record<string, string>;
  const AVOID = ['Naming surf schools, camps, resorts or shops.', 'Describing windsurfing, kitesurfing, beach swimming, sunbathing, or snorkeling and diving.'];
  const out: Record<string, unknown> = { _note: 'Surfing notes (Oct 2026), built by scripts/build-surfing-facts.ts from the surfing columns on the interest page; first drafts, only partly checked against web sources. Passed to Gemini as ground truth.' };
  for (const id of new Set([...stored.keys(), ...Object.keys(scopes)])) {
    const r = stored.get(id) ?? {};
    const facts: string[] = ['These notes are first drafts: some were checked against web sources and some were not. Use what you are sure of and leave out anything you doubt.'];
    if (r.breaks) facts.push(`Signature breaks, as Break (type, level, months): ${r.breaks}.`);
    if (Array.isArray(r.waveType) && r.waveType.length) facts.push(`Wave types among the signature breaks: ${r.waveType.map((w) => label('waveType', w)).join(', ')}.`);
    if (r.waveSize) facts.push(`Typical wave size (face height): ${r.waveSize}.`);
    if (r.waterTemp) facts.push(`Water temperature and wetsuit: ${r.waterTemp}.`);
    if (r.hazards) facts.push(`Main hazards: ${r.hazards}.`);
    if (r.crowds) facts.push(`Crowds at the main breaks: ${label('crowds', r.crowds)}.`);
    if (r.consistency) facts.push(`Consistency: ${label('consistency', r.consistency)}.`);
    if (r.waveDirection) facts.push(`Signature breaks peel: ${label('waveDirection', r.waveDirection)}.`);
    if (r.localism) facts.push(`Localism at the main breaks: ${label('localism', r.localism)}.`);
    if (r.access) facts.push(`How visitors reach the waves: ${label('access', r.access)}.`);
    if (r.lessons) facts.push(`Surf lessons and board rental: ${label('lessons', r.lessons)}.`);
    if (Array.isArray(r.boards) && r.boards.length) facts.push(`Boards that suit the place: ${r.boards.map((b) => label('boards', b)).join(', ')}.`);
    if (r.permits) facts.push(`Permits, fees or limits: ${r.permits}.`);
    // Notes typed on the interest page (scope, must-mention, extra avoid) win over the scope file.
    const notes = r as { scopeNote?: string; mustMention?: string[]; extraAvoid?: string[] };
    out[id] = { forPlaceName: nameOf.get(id) ?? '', scope: notes.scopeNote || scopes[id] || '', facts: facts.length > 1 ? facts : [], avoid: [...AVOID, ...(notes.extraAvoid ?? [])], season: '', mustMention: notes.mustMention ?? [] };
  }
  writeFileSync(join(__dirname, '..', 'docs', 'surfing-facts.json'), JSON.stringify(out, null, 1));
  console.log(`Wrote ${Object.keys(out).length - 1} fact sheets.`);
  process.exit(0);
})();
