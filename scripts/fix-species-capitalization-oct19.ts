// Brings the wildlife, whale watching, birding and safari text in line with the 19 Oct 2026 rule: bird names are capitalized (every word of a
// specific species, plural included), every other animal is lowercase except for proper nouns and adjectives inside the name.
// Capitalization only: each result is checked to equal the original once case is ignored. Bird RENAMES (to eBird names) are not done here.
//
// Usage: npx tsx scripts/fix-species-capitalization-oct19.ts            (dry run, prints counts)
//        npx tsx scripts/fix-species-capitalization-oct19.ts --apply   (writes through the audited admin edit path)
import { readFileSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places } from '../src/lib/db/schema';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const INTERESTS = ['wildlifeViewing', 'whaleWatching', 'birding', 'safari'];
type Rule = { find: RegExp; to: (m: RegExpMatchArray) => string };
const lit = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const title = (s: string) => s.replace(/(^|[ \-])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/Bee-Eater/g, 'Bee-eater').replace(/Three-Toed/g, 'Three-toed').replace(/White-Fronted/g, 'White-fronted');
/** Birds written in lowercase (or half-capitalized): the whole name, singular or plural, becomes Title Case. */
const bird = (lower: string): Rule => {
  const words = lower.split(' ');
  const flex = words.map((w, i) => (i === 0 ? `[${w[0].toUpperCase()}${w[0]}]${lit(w.slice(1))}` : `[${w[0].toUpperCase()}${w[0]}]${lit(w.slice(1))}`)).join(' ');
  return { find: new RegExp(`\\b${flex}(?=s?\\b)`, 'g'), to: (m) => title(m[0].toLowerCase()) };
};
const RULES: Rule[] = [
  // Non-birds: lowercase.
  { find: /Hilaire's Side-necked Turtle/g, to: () => "Hilaire's side-necked turtle" },
  { find: /\bLeopard Cat\b/g, to: () => 'leopard cat' },
  { find: /Ugandan Red Colobus/g, to: () => 'Ugandan red colobus' },
  { find: /\bLand Iguana/g, to: () => 'land iguana' },
  // Birds: Title Case.
  ...['white tern', 'grey heron', 'Fiordland crested penguin', 'spotted nutcracker', 'griffon vulture', 'white-fronted goose', 'greylag goose', 'three-toed woodpecker', 'pied flycatcher', 'rockhopper penguin', 'carmine bee-eater', 'emerald toucanet', 'golden oriole', 'common guillemot', 'common teal', 'little blue penguin', 'cape petrel', 'eurasian hoopoe', 'houbara bustard', "bewick's swan", 'jabiru stork', 'eurasian teal', 'west indian flamingo', 'wandering albatross', 'brent goose'].map((s) => bird(s.toLowerCase())),
  { find: /\b[Ss]hy and Black-browed Albatross/g, to: () => 'Shy and Black-browed Albatross' },
];
// Plural forms that do not end in a plain s.
const IRREGULAR: Array<[RegExp, string]> = [[/\b[Gg]eese\b/g, '']];

function fix(t: string): string {
  let out = t;
  for (const r of RULES) out = out.replace(r.find, (...a) => r.to(a as unknown as RegExpMatchArray));
  // "geese" and "albatrosses" ride along: a Title-Cased singular above leaves the plural ending lowercase, which is what we want ("Brent Geese" handled below).
  out = out.replace(/\b(White-fronted|Greylag|Brent) [Gg]eese\b/g, '$1 Geese').replace(/\b(white-fronted|greylag|brent) geese\b/gi, (m) => title(m.toLowerCase()));
  out = out.replace(/\b[Ww]andering [Aa]lbatrosses\b/g, 'Wandering Albatrosses');
  return out;
}
void IRREGULAR;
const strip = (s: string) => s.replace(/\*\*/g, '');

async function main() {
  const apply = process.argv.includes('--apply');
  const db = drizzle(postgres(process.env.DATABASE_URL as string, { prepare: false, max: 2 }));
  const rows = await db.select().from(places);
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const changes = new Map<string, number>();
  let texts = 0;
  for (const r of rows) {
    const ov = { ...((r.sliderOverview as Record<string, string>) ?? {}) };
    const mo = { ...((r.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {}) };
    let changed = false;
    for (const k of INTERESTS) {
      const o = ov[k];
      if (o) {
        const f = fix(o);
        if (f !== o) { if (strip(f).toLowerCase() !== strip(o).toLowerCase()) throw new Error(`${r.id}/${k}: wording changed`); ov[k] = f; changed = true; texts++; for (const m of diffs(o, f)) changes.set(m, (changes.get(m) ?? 0) + 1); }
      }
      const ms = mo[k];
      if (ms) {
        mo[k] = ms.map((t) => {
          if (!t) return t;
          const f = fix(t);
          if (f === t) return t;
          if (strip(f).toLowerCase() !== strip(t).toLowerCase()) throw new Error(`${r.id}/${k}: wording changed`);
          changed = true; texts++;
          for (const m of diffs(t, f)) changes.set(m, (changes.get(m) ?? 0) + 1);
          return f;
        });
      }
    }
    if (!changed) continue;
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    patches.push({ ...base, field: 'sliderOverview', value: ov }, { ...base, field: 'sliderMonthlyWeather', value: mo });
  }
  console.log(`${texts} texts in ${patches.length / 2} places would change. Distinct changes:`);
  console.log([...changes.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${n}  ${k}`).join('\n'));
  if (!apply) process.exit(0);
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('patches', patches.length, 'saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
}
/** The words that changed, as "before -> after", for the report. */
function diffs(a: string, b: string): string[] {
  const x = strip(a).split(/(\s+)/), y = strip(b).split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && x[i]?.trim()) out.push(`${x[i]} -> ${y[i]}`);
  return out;
}
main();
