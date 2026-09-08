import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Scores birding from first principles and reports where the catalogue
 * disagrees.
 *
 * The stated model:
 *   species COUNT        50%   the primary driver
 *   UNIQUENESS/endemism  25%   birds you cannot see anywhere else
 *   CHARISMA             25%   birds worth looking at, not little brown jobs
 *   SPECTACLE            +25%  a BONUS on top, never a foundation
 *
 * The last line is the load-bearing one. Spectacle multiplies rather than
 * adds, so it can lift a rich destination further but cannot carry a
 * fifty-species island to the top of the scale. A million puffins is a
 * magnificent thing to witness and it is still ninety species.
 *
 * Components are judgements, scored 0-10 against the best destination on
 * earth for that component, and always AT THE DESTINATION'S OWN SCOPE —
 * `thailand` is "Thailand — Phuket & Islands", a southern beach region, not
 * the country whose list runs past a thousand. Getting that wrong is what
 * produced a confident and completely mistaken proposal to raise it.
 *
 * This is a review instrument, not an authority. Where the model and the
 * catalogue disagree, either can be the one that is wrong; the point is to
 * make the disagreement visible and force a reason.
 *
 * Read-only.
 */

type Row = {
  /** species richness within the destination's actual scope */
  count: number;
  /** endemism — birds found here and nowhere else */
  uniq: number;
  /** how spectacular the birds are to look at */
  char: number;
  /** mass concentration: colonies, migration bottlenecks, roosts */
  spec: number;
};

const M: Record<string, Row> = {
  // ---- Neotropics -------------------------------------------------------
  'ecuadorian-andes': { count: 10, uniq: 9, char: 10, spec: 3 },
  'colombian-andes': { count: 10, uniq: 9, char: 10, spec: 3 },
  peru: { count: 10, uniq: 8, char: 9, spec: 4 },
  'peruvian-amazon': { count: 9, uniq: 7, char: 10, spec: 6 },
  'costa-rica': { count: 9, uniq: 6, char: 10, spec: 3 },
  panama: { count: 9, uniq: 6, char: 9, spec: 6 },
  pantanal: { count: 7, uniq: 5, char: 10, spec: 9 },
  'colombian-caribbean': { count: 7, uniq: 8, char: 8, spec: 2 },
  chiapas: { count: 7, uniq: 6, char: 8, spec: 2 },
  guatemala: { count: 7, uniq: 6, char: 8, spec: 2 },
  oaxaca: { count: 7, uniq: 7, char: 7, spec: 2 },
  belize: { count: 6, uniq: 4, char: 8, spec: 3 },
  nicaragua: { count: 6, uniq: 4, char: 7, spec: 2 },
  mexicocity: { count: 5, uniq: 4, char: 6, spec: 3 },
  galapagos: { count: 3, uniq: 10, char: 9, spec: 8 },
  'argentine-lake-district': { count: 4, uniq: 4, char: 6, spec: 2 },
  'chilean-lake-district': { count: 4, uniq: 4, char: 6, spec: 2 },
  'torres-del-paine': { count: 3, uniq: 4, char: 7, spec: 3 },
  'tierra-del-fuego': { count: 3, uniq: 4, char: 6, spec: 3 },
  'el-chalten': { count: 3, uniq: 4, char: 6, spec: 2 },
  mendoza: { count: 4, uniq: 3, char: 5, spec: 2 },
  uyuni: { count: 2, uniq: 5, char: 8, spec: 7 },
  atacama: { count: 3, uniq: 5, char: 7, spec: 5 },
  falklands: { count: 2, uniq: 5, char: 10, spec: 10 },
  'puerto-rico': { count: 4, uniq: 6, char: 6, spec: 2 },
  barbados: { count: 3, uniq: 3, char: 5, spec: 2 },

  // ---- Africa -----------------------------------------------------------
  kenya: { count: 9, uniq: 5, char: 9, spec: 9 },
  tanzania: { count: 9, uniq: 5, char: 9, spec: 8 },
  uganda: { count: 9, uniq: 6, char: 10, spec: 5 },
  rwanda: { count: 7, uniq: 6, char: 9, spec: 3 },
  ethiopia: { count: 7, uniq: 8, char: 7, spec: 4 },
  ghana: { count: 8, uniq: 7, char: 8, spec: 3 },
  kruger: { count: 7, uniq: 4, char: 8, spec: 5 },
  botswana: { count: 7, uniq: 4, char: 9, spec: 8 },
  namibia: { count: 6, uniq: 5, char: 7, spec: 6 },
  zambia: { count: 7, uniq: 4, char: 8, spec: 6 },
  zimbabwe: { count: 7, uniq: 4, char: 8, spec: 5 },
  madagascar: { count: 6, uniq: 10, char: 8, spec: 2 },
  'cape-town': { count: 5, uniq: 8, char: 7, spec: 5 },
  seychelles: { count: 2, uniq: 9, char: 7, spec: 6 },
  mauritius: { count: 2, uniq: 8, char: 6, spec: 2 },

  // ---- Asia -------------------------------------------------------------
  borneo: { count: 8, uniq: 8, char: 9, spec: 3 },
  srilanka: { count: 6, uniq: 8, char: 8, spec: 3 },
  bhutan: { count: 7, uniq: 6, char: 8, spec: 6 },
  nepal: { count: 7, uniq: 4, char: 7, spec: 4 },
  vietnam: { count: 8, uniq: 6, char: 7, spec: 2 },
  taiwan: { count: 6, uniq: 7, char: 7, spec: 5 },
  kaziranga: { count: 6, uniq: 5, char: 8, spec: 5 },
  kerala: { count: 6, uniq: 6, char: 7, spec: 3 },
  'rajasthan-golden-triangle': { count: 5, uniq: 4, char: 8, spec: 9 },
  ladakh: { count: 3, uniq: 5, char: 6, spec: 3 },
  hokkaido: { count: 4, uniq: 4, char: 10, spec: 9 },
  palawan: { count: 5, uniq: 8, char: 7, spec: 2 },
  rajaampat: { count: 5, uniq: 8, char: 9, spec: 3 },
  komodo: { count: 3, uniq: 5, char: 6, spec: 2 },
  bali: { count: 4, uniq: 5, char: 6, spec: 2 },
  thailand: { count: 4, uniq: 3, char: 5, spec: 2 },
  bangkok: { count: 5, uniq: 2, char: 6, spec: 5 },
  angkor: { count: 5, uniq: 3, char: 7, spec: 6 },
  bagan: { count: 4, uniq: 2, char: 5, spec: 3 },
  luangprabang: { count: 5, uniq: 3, char: 5, spec: 2 },
  hongkong: { count: 5, uniq: 2, char: 7, spec: 7 },
  singapore: { count: 4, uniq: 2, char: 6, spec: 5 },
  'papua-new-guinea': { count: 8, uniq: 10, char: 10, spec: 3 },
  mongolia: { count: 4, uniq: 4, char: 6, spec: 4 },
  dubai: { count: 3, uniq: 2, char: 5, spec: 5 },
  egypt: { count: 4, uniq: 2, char: 6, spec: 6 },
  jordan: { count: 4, uniq: 3, char: 5, spec: 5 },
  uluru: { count: 3, uniq: 6, char: 5, spec: 2 },

  // ---- Europe & the North ----------------------------------------------
  iceland: { count: 2, uniq: 2, char: 8, spec: 10 },
  'faroe-islands': { count: 1, uniq: 2, char: 8, spec: 10 },
  lofoten: { count: 2, uniq: 1, char: 8, spec: 9 },
  svalbard: { count: 1, uniq: 3, char: 8, spec: 8 },
  antarctica: { count: 1, uniq: 6, char: 10, spec: 10 },
  azores: { count: 2, uniq: 4, char: 6, spec: 6 },
  madeira: { count: 2, uniq: 6, char: 6, spec: 5 },
  canaries: { count: 3, uniq: 6, char: 5, spec: 3 },
  morocco: { count: 5, uniq: 4, char: 7, spec: 9 },
  algarve: { count: 4, uniq: 3, char: 7, spec: 9 },
  mallorca: { count: 4, uniq: 3, char: 6, spec: 5 },
  'scottish-highlands-skye': { count: 3, uniq: 3, char: 7, spec: 6 },
  'great-smoky-mountains': { count: 4, uniq: 3, char: 5, spec: 4 },
  churchill: { count: 3, uniq: 4, char: 8, spec: 8 },
  denali: { count: 3, uniq: 2, char: 6, spec: 3 },
  'denali-interior': { count: 3, uniq: 2, char: 6, spec: 3 },
  yellowstone: { count: 4, uniq: 2, char: 7, spec: 4 },
  everglades: { count: 5, uniq: 4, char: 9, spec: 9 },
  'monterey-big-sur': { count: 4, uniq: 3, char: 8, spec: 8 },
  'vancouver-island': { count: 4, uniq: 2, char: 7, spec: 7 },
  'southeast-alaska': { count: 3, uniq: 2, char: 8, spec: 8 },
  'nova-scotia': { count: 4, uniq: 2, char: 5, spec: 5 },
  acadia: { count: 4, uniq: 2, char: 5, spec: 4 },
  banff: { count: 4, uniq: 2, char: 5, spec: 3 },
  'glacier-waterton': { count: 4, uniq: 2, char: 5, spec: 3 },
  olympic: { count: 4, uniq: 2, char: 5, spec: 3 },
  yosemite: { count: 4, uniq: 2, char: 5, spec: 3 },
  'upper-peninsula': { count: 4, uniq: 2, char: 5, spec: 5 },
  'badlands-black-hills': { count: 4, uniq: 3, char: 5, spec: 3 },
  'new-orleans': { count: 5, uniq: 2, char: 6, spec: 8 },
  'texas-hill-country': { count: 5, uniq: 3, char: 6, spec: 8 },
  gbr: { count: 4, uniq: 4, char: 7, spec: 6 },
  tasmania: { count: 4, uniq: 7, char: 6, spec: 4 },
  'north-island': { count: 3, uniq: 9, char: 7, spec: 3 },
  'milford-sound-fiordland': { count: 3, uniq: 9, char: 7, spec: 3 },
  queenstown: { count: 3, uniq: 8, char: 6, spec: 2 },
  sydney: { count: 5, uniq: 6, char: 7, spec: 3 },
  fiji: { count: 2, uniq: 7, char: 6, spec: 2 },
  maldives: { count: 2, uniq: 2, char: 4, spec: 3 },
};

/** 50% count, 25% uniqueness, 25% charisma, then spectacle as a +25% bonus. */
function modelScore(r: Row): number {
  const base = 0.5 * r.count + 0.25 * r.uniq + 0.25 * r.char;
  return Math.min(10, base * (1 + 0.25 * (r.spec / 10)));
}

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
  process.env.DATABASE_URL = env.DATABASE_URL;
  // Dynamic, after the env is set — see review-scenic-saturation.ts.
  const { getAllScoredPlaces } = await import('../src/lib/db/queries/places');
  const { isSliderNA } = await import('../src/lib/scoring/destinations');
  const scored = await getAllScoredPlaces();

  type Out = { id: string; name: string; actual: number; model: number; gap: number; r: Row };
  const rows: Out[] = [];
  for (const [id, r] of Object.entries(M)) {
    const d = scored.find((x) => x.id === id);
    if (!d || isSliderNA(d, 'birding')) continue;
    const actual = Math.max(...(d.monthly.birding ?? [0]));
    const model = modelScore(r);
    rows.push({ id, name: d.name, actual, model, gap: actual - model, r });
  }

  const show = (list: Out[]) => {
    for (const o of list) {
      const sign = o.gap >= 0 ? '+' : '';
      console.log(
        `  ${(sign + o.gap.toFixed(1)).padStart(5)}  actual ${o.actual.toFixed(0).padStart(2)}  model ${o.model.toFixed(1).padStart(4)}   ` +
          `c${o.r.count} u${o.r.uniq} ch${o.r.char} sp${o.r.spec}   ${o.name}`,
      );
    }
  };

  const over = rows.filter((o) => o.gap >= 1.5).sort((a, b) => b.gap - a.gap);
  const under = rows.filter((o) => o.gap <= -1.5).sort((a, b) => a.gap - b.gap);
  const ok = rows.filter((o) => Math.abs(o.gap) < 1.5);

  console.log(`=== OVER-scored vs the model (${over.length})`);
  show(over);
  console.log(`\n=== UNDER-scored vs the model (${under.length})`);
  show(under);

  if (process.argv.includes('--all')) {
    console.log(`\n=== In agreement, within 1.5 (${ok.length})`);
    show(ok.sort((a, b) => b.actual - a.actual));
  }

  const mean = rows.reduce((s, o) => s + Math.abs(o.gap), 0) / rows.length;
  const corr = (() => {
    const n = rows.length;
    const ma = rows.reduce((s, o) => s + o.actual, 0) / n;
    const mm = rows.reduce((s, o) => s + o.model, 0) / n;
    let num = 0, da = 0, dm = 0;
    for (const o of rows) { num += (o.actual - ma) * (o.model - mm); da += (o.actual - ma) ** 2; dm += (o.model - mm) ** 2; }
    return num / Math.sqrt(da * dm);
  })();

  console.log(`\n${rows.length} destinations modelled. ${ok.length} agree within 1.5, ${over.length} over, ${under.length} under.`);
  console.log(`mean absolute gap ${mean.toFixed(2)}, correlation r = ${corr.toFixed(3)}.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
