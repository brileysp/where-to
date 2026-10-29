// 22 Oct 2026: moves bird names in the live texts to the eBird name, and writes American "gray" for "grey" everywhere in the place texts.
// Group 1 = spelling (grey -> gray), group 2 = the same bird under its eBird name, group 3 = split species, decided place by place,
// group 4 = the owner's calls (only run when listed in --only, after the owner decided). Names follow eBird: https://api.ebird.org/v2/ref/taxonomy/ebird
// A DRY RUN unless --apply is given. Writes before/after sentences to the file given by --out.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fix-bird-names-oct22.ts [--groups=1,2,3] [--only=id,id] [--out=file.json] [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

export interface Rule {
  id: string;
  group: 1 | 2 | 3 | 4;
  from: string;
  to: string;
  /** Only in these places (group 3 and some group 4). */
  places?: string[];
  /** Not when the name sits right after one of these (it is part of a longer name). */
  not?: string[];
  /** Write the plural with the name ("Herons" stays "Herons"). Always true for names; off only for the grey rule. */
}

const R = (id: string, group: Rule['group'], from: string, to: string, extra: Partial<Rule> = {}): Rule => ({ id, group, from, to, ...extra });

export const RULES: Rule[] = [
  // ---- group 2: same bird, eBird name ----
  R('common-starling', 2, 'Common Starling', 'European Starling'),
  R('pied-flycatcher', 2, 'Pied Flycatcher', 'European Pied Flycatcher', { not: ['European ', 'Little ', 'Atlas ', 'Collared ', 'Semicollared '] }),
  R('european-honey-buzzard', 2, 'European Honey Buzzard', 'European Honey-buzzard'),
  R('honey-buzzard', 2, 'Honey Buzzard', 'European Honey-buzzard', { not: ['European ', 'Oriental ', 'Eurasian '] }),
  R('golden-oriole', 2, 'Golden Oriole', 'Eurasian Golden Oriole', { not: ['Eurasian ', 'African ', 'Indian ', 'Black-naped ', 'Dark-throated ', 'Slender-billed '] }),
  R('common-kestrel', 2, 'Common Kestrel', 'Eurasian Kestrel'),
  R('eurasian-roller', 2, 'Eurasian Roller', 'European Roller'),
  R('three-toed-woodpecker', 2, 'Three-toed Woodpecker', 'Eurasian Three-toed Woodpecker', { not: ['Eurasian ', 'American ', 'Northern '] }),
  R('sand-martin', 2, 'Sand Martin', 'Bank Swallow'),
  R('ringed-plover', 2, 'Ringed Plover', 'Common Ringed Plover', { not: ['Little ', 'Common ', 'Semipalmated ', 'Greater ', 'Lesser '] }),
  R('arctic-skua', 2, 'Arctic Skua', 'Parasitic Jaeger'),
  R('diederik-cuckoo', 2, 'Diederik Cuckoo', 'Dideric Cuckoo'),
  R('wynaad', 2, 'Wynaad Laughingthrush', 'Wayanad Laughingthrush'),
  R('humes-pheasant', 2, "Hume's Pheasant", "Mrs. Hume's Pheasant", { not: ["Mrs. "] }),
  R('handsome-francolin', 2, 'Handsome Francolin', 'Handsome Spurfowl'),
  R('jabiru-stork', 2, 'Jabiru Stork', 'Jabiru'),
  R('griffon-vulture', 2, 'Griffon Vulture', 'Eurasian Griffon', { not: ['Eurasian ', "Rüppell's ", 'Himalayan ', 'Cape ', 'Indian ', 'White-backed '] }),
  R('west-indian-flamingo', 2, 'West Indian Flamingo', 'American Flamingo'),
  R('fiordland-crested-penguin', 2, 'Fiordland Crested Penguin', 'Fiordland Penguin'),
  R('little-blue-penguin', 2, 'Little Blue Penguin', 'Little Penguin'),
  R('king-shag', 2, 'King Shag', 'New Zealand King Shag', { not: ['New Zealand '] }),
  R('seychelles-black-parrot', 2, 'Seychelles Black Parrot', 'Seychelles Parrot'),
  R('caucasian-black-grouse', 2, 'Caucasian Black Grouse', 'Caucasian Grouse'),
  R('crimson-breasted-shrike', 2, 'Crimson-breasted Shrike', 'Crimson-breasted Gonolek'),
  R('panders-ground-jay', 2, "Pander's Ground Jay", 'Turkestan Ground-Jay'),
  R('atlantic-canary', 2, 'Atlantic Canary', 'Island Canary'),
  R('major-mitchells', 2, "Major Mitchell's Cockatoo", 'Pink Cockatoo'),
  R('red-fronted-serin', 2, 'Red-fronted Serin', 'Fire-fronted Serin'),
  R('australian-white-ibis', 2, 'Australian White Ibis', 'Australian Ibis'),
  R('cuban-pygmy-owl', 2, 'Cuban Pygmy Owl', 'Cuban Pygmy-Owl'),
  R('palau-owl', 2, 'Palau Owl', 'Palau Scops-Owl'),
  R('african-crimson-winged-finch', 2, 'African Crimson-winged Finch', 'Crimson-winged Finch'),
  R('streaked-fantail', 2, 'Streaked Fantail', 'Fiji Streaked Fantail', { places: ['fiji'], not: ['Fiji ', 'Vanuatu ', 'New Caledonian '] }),
  R('hooded-pitta', 2, 'Hooded Pitta', 'Western Hooded Pitta', { places: ['singapore'], not: ['Western ', 'Eastern ', 'Nicobar ', 'Minahasa ', 'Biak '] }),
  R('yellow-wagtail', 2, 'Yellow Wagtail', 'Western Yellow Wagtail', { places: ['kenya'], not: ['Western ', 'Eastern ', 'Citrine '] }),
  R('emerald-toucanet', 2, 'Emerald Toucanet', 'Northern Emerald-Toucanet', { places: ['nicaragua'], not: ['Northern ', 'Southern '] }),
  R('maui-creeper', 2, 'Maui Creeper', 'Maui Alauahio'),
  R('pacific-slope-flycatcher', 2, 'Pacific-slope Flycatcher', 'Western Flycatcher'),
  R('eurasian-reed-warbler', 2, 'Eurasian Reed Warbler', 'Common Reed Warbler'),
  R('steeres-liocichla', 2, "Steere's Liocichla", 'Taiwan Liocichla'),
  R('southern-white-crowned-shrike', 2, 'Southern White-crowned Shrike', 'White-crowned Shrike'),
  // ---- group 3: split species, by place ----
  R('goshawk-eurasian', 3, 'Northern Goshawk', 'Eurasian Goshawk', { places: ['berlin'], not: ['Eurasian ', 'American '] }),
  R('goshawk-american', 3, 'Northern Goshawk', 'American Goshawk', { places: ['upper-peninsula'], not: ['Eurasian ', 'American '] }),
  R('nutcracker-spotted', 3, 'Spotted Nutcracker', 'Northern Nutcracker', { places: ['black-forest', 'chamonix', 'swissalps'] }),
  R('nutcracker-eurasian', 3, 'Eurasian Nutcracker', 'Northern Nutcracker', { places: ['black-forest', 'chamonix', 'swissalps'] }),
  R('rockhopper', 3, 'Rockhopper Penguin', 'Western Rockhopper Penguin', { places: ['falklands'], not: ['Western ', 'Eastern ', 'Southern ', "Moseley's ", 'Northern '] }),
  R('houbara-african', 3, 'Houbara Bustard', 'African Houbara', { places: ['canaries'] }),
  R('houbara-asian', 3, "MacQueen's Bustard", 'Asian Houbara', { places: ['uzbekistan'] }),
  R('sand-plover', 3, 'Lesser Sand Plover', 'Siberian Sand-Plover', { places: ['maldives'] }),
  // ---- group 4: the owner's calls (run only with --only, after a decision) ----
  R('bewicks-swan', 4, "Bewick's Swan", 'Tundra Swan'),
  R('eurasian-teal', 4, 'Eurasian Teal', 'Green-winged Teal'),
  R('steppe-buzzard', 4, 'Steppe Buzzard', 'Common Buzzard'),
  R('japanese-tit', 4, 'Japanese Tit', 'Asian Tit'),
  R('siberian-tit', 4, 'Siberian Tit', 'Gray-headed Chickadee'),
  R('guldenstadts', 4, "Güldenstädt's Redstart", 'White-winged Redstart'),
  R('guldenstadts-plain', 4, "Guldenstadt's Redstart", 'White-winged Redstart'),
  R('wandering-albatross', 4, 'Wandering Albatross', 'Snowy Albatross'),
  R('spanish-imperial-eagle', 4, 'Spanish Imperial Eagle', 'Spanish Eagle'),
  R('cape-petrel', 4, 'Cape Petrel', 'Pintado Petrel'),
  R('feas-petrel', 4, "Fea's Petrel", 'Desertas Petrel'),
  R('brent-geese', 4, 'Pale-bellied Brent Goose', 'Brant'),
  R('corncrake', 4, 'Corncrake', 'Corn Crake'),
  R('little-auk', 4, 'Little Auk', 'Dovekie'),
  R('common-guillemot', 4, 'Common Guillemot', 'Common Murre'),
  R('brunnichs-guillemot', 4, "Brünnich's Guillemot", 'Thick-billed Murre'),
  R('nene', 4, 'Nene', 'Hawaiian Goose'),
  R('galapagos-accents', 4, 'Galápagos Penguin', 'Galapagos Penguin'),
  R('adelie-accent', 4, 'Adélie Penguin', 'Adelie Penguin'),
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The pattern for a rule: the name as a whole word (a plural ending is left in place), not inside a longer name. */
export function patternFor(r: Rule): RegExp {
  const behind = (r.not ?? []).map((n) => `(?<!${esc(n)})`).join('');
  return new RegExp(`(?<![\\p{L}'’-])${behind}${esc(r.from)}(?=(?:e?s)?(?![\\p{L}-]))`, 'gu');
}
/** Brent geese come as "Pale-bellied Brent Geese", "dark-bellied Brent Geese" or just "brent geese": handled by hand below. */
const BRENT = /\b(?:[Pp]ale-bellied |[Dd]ark-bellied )?[Bb]rent [Gg]eese\b/g;
const GREY = /grey/gi;
const grayOf = (m: string) => (m === 'GREY' ? 'GRAY' : m[0] === 'G' ? 'Gray' : 'gray');

export interface Change { rule: string; place: string; field: string; before: string; after: string }

/** The rewritten text and what changed in it. */
export function rewrite(text: string, place: string, field: string, active: Rule[], includeGrey: boolean, brent: boolean): { text: string; changes: Change[] } {
  let out = text;
  const changes: Change[] = [];
  const note = (rule: string, before: string, index: number, matched: string, replaced: string) => changes.push({ rule, place, field, before: before.slice(Math.max(0, index - 40), index + matched.length + 40), after: before.slice(Math.max(0, index - 40), index) + replaced + before.slice(index + matched.length, index + matched.length + 40) });
  for (const r of active) {
    if (r.places && !r.places.includes(place)) continue;
    if (r.id === 'brent-geese') continue;
    const re = patternFor(r);
    const before = out;
    out = before.replace(re, (m, ...args) => { const idx = args[args.length - 2] as number; note(r.id, before, idx, m, r.to); return r.to; });
  }
  if (brent) {
    // Birds are written in Title Case, whatever the old casing, so every Brent goose becomes Brant.
    const before = out;
    out = before.replace(BRENT, (m, ...args) => { const idx = args[args.length - 2] as number; const to = 'Brant'; note('brent-geese', before, idx, m, to); return to; });
  }
  if (includeGrey) {
    const before = out;
    out = before.replace(GREY, (m, ...args) => { const idx = args[args.length - 2] as number; note('grey-to-gray', before, idx, m, grayOf(m)); return grayOf(m); });
  }
  return { text: out, changes };
}

(async () => {
  const argv = process.argv.slice(2);
  const arg = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
  const apply = argv.includes('--apply');
  const groups = (arg('groups') ?? '1,2,3').split(',').map(Number);
  const only = arg('only')?.split(',') ?? [];
  const out = arg('out');
  const active = RULES.filter((r) => (groups.includes(r.group) && r.group !== 4) || only.includes(r.id));
  const includeGrey = groups.includes(1) || only.includes('grey-to-gray');
  const brent = only.includes('brent-geese');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { SPECIES_CASE_INTERESTS } = await import('../src/lib/text/species-case');
  const rows = await db.select().from(places);
  const all: Change[] = [];
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  for (const r of rows) {
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    const birdKeys = SPECIES_CASE_INTERESTS;
    // Bird names: only the four animal interests. "grey": every interest's text, and the place's own overview and about text.
    const doText = (t: string, field: string, key: string | null) => rewrite(t, r.id, field, key === null || birdKeys.has(key) ? active : [], includeGrey, brent && (key === null || birdKeys.has(key)));
    const ov = { ...((r.sliderOverview as Record<string, string>) ?? {}) };
    const mo = { ...((r.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {}) };
    let ovChanged = false; let moChanged = false;
    for (const [k, t] of Object.entries(ov)) { if (!t) continue; const x = doText(t, `sliderOverview.${k}`, k); if (x.text !== t) { ov[k] = x.text; ovChanged = true; all.push(...x.changes); } }
    for (const [k, arr] of Object.entries(mo)) { if (!arr) continue; mo[k] = arr.map((t, i) => { if (!t) return t; const x = doText(t, `sliderMonthlyWeather.${k}[${i}]`, k); if (x.text !== t) { moChanged = true; all.push(...x.changes); } return x.text; }); }
    if (ovChanged) patches.push({ ...base, field: 'sliderOverview', value: ov });
    if (moChanged) patches.push({ ...base, field: 'sliderMonthlyWeather', value: mo });
    if (includeGrey) {
      for (const f of ['about', 'overview'] as const) { const t = r[f]; if (!t) continue; const x = rewrite(t, r.id, f, [], true, false); if (x.text !== t) { patches.push({ ...base, field: f, value: x.text }); all.push(...x.changes); } }
      const mw = r.monthlyWeather as (string | null)[] | null;
      if (mw) { let ch = false; const nm = mw.map((t, i) => { if (!t) return t; const x = rewrite(t, r.id, `monthlyWeather[${i}]`, [], true, false); if (x.text !== t) { ch = true; all.push(...x.changes); } return x.text; }); if (ch) patches.push({ ...base, field: 'monthlyWeather', value: nm }); }
    }
  }
  const byRule = new Map<string, { n: number; places: Map<string, number> }>();
  for (const c of all) { const e = byRule.get(c.rule) ?? { n: 0, places: new Map() }; e.n++; e.places.set(c.place, (e.places.get(c.place) ?? 0) + 1); byRule.set(c.rule, e); }
  for (const [rule, e] of [...byRule.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(`${String(e.n).padStart(4)}  ${rule}  ${[...e.places.entries()].map(([p, n]) => `${p}(${n})`).join(', ')}`);
  console.log(`${all.length} changes in ${new Set(all.map((c) => c.place)).size} places, ${patches.length} field patches`);
  if (out) writeFileSync(out, JSON.stringify(all, null, 1));
  if (!apply) { console.log('dry run'); process.exit(0); }
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('patches', patches.length, 'saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
