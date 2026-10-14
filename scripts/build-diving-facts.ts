// Builds docs/diving-facts.json (the ground-truth fact sheets sent to Gemini) from the diving columns in the database,
// so anything edited on the interest page flows into the next run. Falls back to scripts/data/diving-fill.json for places with
// no stored columns yet. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/build-diving-facts.ts
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
  }
}

const ACCESS: Record<string, string> = { dayBoat: 'a day boat from a nearby harbor', shore: 'from the shore or a house reef (no boat needed)', liveaboard: 'by liveaboard (a multi-day dive boat to remote sites)', mixed: 'in several styles (day boats, shore and liveaboards)' };
const CERT: Record<string, string> = { none: 'no certification (snorkeling or introductory dives)', openWater: 'Open Water certification', advanced: 'Advanced certification (deeper sites or stronger current)', specialty: 'specialty training (cave, wreck, technical, drysuit or ice)' };
const CUR: Record<string, string> = { none: 'little or no current', mild: 'mild current', moderate: 'moderate current', strong: 'strong current (drift diving)' };
const DRAW: Record<string, string> = { reef: 'coral reef scenery and its fish', animals: 'being in the water with animals (sharks, rays, turtles, sea lions and similar) over rock or open water, not coral reef scenery', wrecks: 'wrecks', caves: 'caves and cenotes', kelp: 'kelp forests and cold-water reef', mixed: 'several kinds of site about equally (reef, wrecks, walls, caves)', other: 'something unusual rather than a reef (for example a spring, a rift, ice, a lake or interesting rock formations)' };

async function main() {
  loadEnv();
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places } = await import('../src/lib/db/schema');
  const { divingFormatCallouts } = await import('../src/lib/admin/interest-pages/config');
  // Current place names, recorded in each sheet so a later rename or re-scope is caught before a run (forPlaceName).
  const nameOf = new Map((await db.select({ id: places.id, name: places.name }).from(places)).map((p) => [p.id, p.name]));
  const { eq } = await import('drizzle-orm');
  const stored = new Map((await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, 'diving'))).map((r) => [r.placeId, r.facts as Record<string, string>]));
  const fill = JSON.parse(readFileSync(join(__dirname, 'data', 'diving-fill.json'), 'utf8')) as Record<string, Record<string, string>>;
  // Scope sheets for places that were renamed or broadened (docs/renamed-places.json): the whole place, never the old name.
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'diving-scopes.json'), 'utf8')) as Record<string, string>;
  // Per-place seasonal ground truth (what really changes month to month), source-checked 9 Oct 2026: { season, extraFacts, animalsOverride? }.
  const seasons = JSON.parse(readFileSync(join(__dirname, 'data', 'diving-seasons.json'), 'utf8')) as Record<string, { season: string; extraFacts?: string[]; animalsOverride?: string }>;
  // Notes typed on the interest page (scope, must-mention, extra avoid) win over the scope file.
  const notes = (id: string) => (stored.get(id) ?? {}) as unknown as { scopeNote?: string; mustMention?: string[]; extraAvoid?: string[] };
  const out: Record<string, unknown> = { _note: "Snorkeling & diving fact sheets (Oct 2026), built by scripts/build-diving-facts.ts from the diving columns on the interest page; NOT yet source-checked. Passed to Gemini as ground truth. 'Typical' means a coral-reef place done by day boat, Open Water, 10-30 m, little or mild current and warm water: it needs no format wording." };
  for (const id of new Set([...stored.keys(), ...Object.keys(fill), ...Object.keys(scopes)])) {
    const r = { ...(fill[id] ?? {}), ...(stored.get(id) ?? {}) } as Record<string, string>;
    // "How you do it" is a multi-select (13 Oct 2026): a list of ways. An older single word still reads as one way; the old "mixed" says nothing.
    const ways = ((Array.isArray(r.accessStyle) ? r.accessStyle : r.accessStyle && r.accessStyle !== 'mixed' ? [r.accessStyle] : []) as string[]);
    if (!r.certification) {
      if (scopes[id] || notes(id).scopeNote) out[id] = { forPlaceName: nameOf.get(id) ?? '', scope: notes(id).scopeNote || scopes[id], facts: [], avoid: ['Naming dive shops, resorts, liveaboards or operators.', 'Counting animals that can only be watched from a boat or the shore.', 'Describing one town or island as if it were the whole place.', ...(notes(id).extraAvoid ?? [])], season: '', mustMention: notes(id).mustMention ?? [] };
      continue;
    }
    const facts = [
      ...(ways.length ? [`The usual way${ways.length > 1 ? 's' : ''} to dive and snorkel here ${ways.length > 1 ? 'are' : 'is'}: ${ways.map((w) => ACCESS[w] ?? w).join('; ')}${ways.length === 1 && ways[0] === 'liveaboard' ? ' only' : ''}.`] : []),
      `The main dive sites need ${CERT[r.certification] ?? r.certification}.`,
      `Typical depth of the main sites: ${r.typicalDepth}. Water temperature: ${r.waterTemp}, with ${CUR[r.current] ?? r.current}.`,
    ];
    if (r.drawType) facts.push(`What visitors mostly go underwater for: ${DRAW[r.drawType] ?? r.drawType}.`);
    const animals = seasons[id]?.animalsOverride ?? r.animals;
    if (animals) facts.push(`Animals to know about, with how likely they are and when (a helpful pointer, not a complete list): ${animals}.`);
    facts.push(...(seasons[id]?.extraFacts ?? []));
    const callout = divingFormatCallouts(r);
    facts.push(callout.reasons.length === 0 ? 'Format callout: NONE. This place is typical, so do not mention the format (boats, certification, depth, current, water temperature) anywhere in the text. Spend the words on what a visitor sees.' : `Format callout: say these in ONE short clause in the overview, nothing more, and mention them in a month only if it matters that month: ${callout.reasons.join('; ')}.`);
    out[id] = { forPlaceName: nameOf.get(id) ?? '', scope: notes(id).scopeNote || scopes[id] || '', facts, avoid: ['Naming dive shops, resorts, liveaboards or operators.', 'Counting animals that can only be watched from a boat or the shore.', 'Headlining an in-water encounter that is rare (list it only as an occasional extra, or leave it out).', ...(notes(id).extraAvoid ?? [])], season: seasons[id]?.season ?? '', mustMention: notes(id).mustMention ?? [] };
  }
  writeFileSync(join(__dirname, '..', 'docs', 'diving-facts.json'), JSON.stringify(out, null, 1));
  console.log(`Wrote ${Object.keys(out).length - 1} fact sheets.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
