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
 * COUNT IS GRADED ON A CURVE. Scoring species richness linearly against
 * Ecuador is not a fair test: past a few hundred available species a
 * two-week trip cannot see them all anyway, so the difference between 60
 * and 290 species matters enormously to a trip and the difference between
 * 900 and 1,600 barely matters at all. The count component therefore takes
 * an approximate species total for the destination's own scope and maps it
 * logarithmically between 20 and 1,600. A happy side effect is that the
 * result is insensitive to modest errors in the estimate — doubling a
 * count moves the score by about 1.6 points, so these numbers need to be
 * roughly right rather than exact.
 *
 * LINEAGE IS A SECOND BONUS, parallel to spectacle, and it exists because
 * uniqueness at 25% could not express what Madagascar is. To be precise
 * about the arithmetic, since it is easy to state this wrongly: uniqueness
 * carries its full 25% weight, contributing up to 2.5 points of the base.
 * The problem is the SPREAD, not the weight. No serious birding destination
 * scores below about 4 on uniqueness, so the usable band is 4-10, worth 1.0
 * to 2.5 points — and the gap between "a good number of endemic species"
 * (6) and "five endemic FAMILIES found nowhere on earth" (10) is one point
 * of a ten-point score. To a birder those are not points on one continuum but different
 * categories of trip: you can add whole branches of the avian family tree
 * to a life list in only a handful of places, and that is exactly why
 * people accept Madagascar's short list and go anyway. Grading count on a
 * curve alone does NOT fix this — the log curve puts Madagascar's 290
 * species at 6.1, almost exactly the hand estimate it replaced.
 *
 * Other components are judgements, scored 0-10 against the best destination on
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
  /** approximate species total for the destination's own scope */
  n: number;
  /** endemism at species level — birds found here and nowhere else */
  uniq: number;
  /** how spectacular the birds are to look at */
  char: number;
  /** mass concentration: colonies, migration bottlenecks, roosts */
  spec: number;
  /** family-level endemism — whole branches of the tree found only here */
  lineage: number;
};

// Calibrated, not guessed. At N_MIN = 20 the curve compressed everything
// above 200 species into a narrow high band and the model flipped to
// reporting 16 under-scored destinations; 40 puts a 240-species temperate
// park near 4.9 and a 1,000-species tropical one near 8.7, which is the
// spread the catalogue's own top and bottom already imply.
const N_MIN = 40;
const N_MAX = 1600;

/** Species richness on a log curve between N_MIN and N_MAX. */
function countScore(n: number): number {
  const v = (10 * (Math.log(n) - Math.log(N_MIN))) / (Math.log(N_MAX) - Math.log(N_MIN));
  return Math.max(0, Math.min(10, v));
}

const M: Record<string, Row> = {
  // ---- Neotropics -------------------------------------------------------
  'ecuadorian-andes': { n: 1600, uniq: 9, char: 10, spec: 3, lineage: 3 },
  'colombian-andes': { n: 1000, uniq: 9, char: 10, spec: 3, lineage: 2 },
  peru: { n: 1000, uniq: 8, char: 9, spec: 4, lineage: 2 },
  'peruvian-amazon': { n: 600, uniq: 7, char: 10, spec: 6, lineage: 2 },
  'costa-rica': { n: 920, uniq: 6, char: 10, spec: 3, lineage: 1 },
  panama: { n: 1000, uniq: 6, char: 9, spec: 6, lineage: 1 },
  pantanal: { n: 450, uniq: 5, char: 10, spec: 9, lineage: 1 },
  'colombian-caribbean': { n: 600, uniq: 8, char: 8, spec: 2, lineage: 1 },
  chiapas: { n: 660, uniq: 6, char: 8, spec: 2, lineage: 0 },
  guatemala: { n: 750, uniq: 6, char: 8, spec: 2, lineage: 0 },
  oaxaca: { n: 700, uniq: 7, char: 7, spec: 2, lineage: 0 },
  belize: { n: 590, uniq: 4, char: 8, spec: 3, lineage: 0 },
  nicaragua: { n: 700, uniq: 4, char: 7, spec: 2, lineage: 0 },
  mexicocity: { n: 350, uniq: 4, char: 6, spec: 3, lineage: 0 },
  // Darwin's finches are a radiation rather than a family, but the islands
  // are the textbook case of endemic lineage and hold endemic genera.
  galapagos: { n: 60, uniq: 10, char: 9, spec: 8, lineage: 8 },
  'argentine-lake-district': { n: 250, uniq: 4, char: 6, spec: 2, lineage: 1 },
  'chilean-lake-district': { n: 250, uniq: 4, char: 6, spec: 2, lineage: 1 },
  'torres-del-paine': { n: 120, uniq: 4, char: 7, spec: 3, lineage: 1 },
  'tierra-del-fuego': { n: 120, uniq: 4, char: 6, spec: 3, lineage: 1 },
  'el-chalten': { n: 120, uniq: 4, char: 6, spec: 2, lineage: 1 },
  mendoza: { n: 250, uniq: 3, char: 5, spec: 2, lineage: 0 },
  uyuni: { n: 80, uniq: 5, char: 8, spec: 7, lineage: 0 },
  atacama: { n: 130, uniq: 5, char: 7, spec: 5, lineage: 0 },
  falklands: { n: 60, uniq: 6, char: 10, spec: 10, lineage: 3 },
  'puerto-rico': { n: 350, uniq: 6, char: 6, spec: 2, lineage: 1 },
  barbados: { n: 230, uniq: 3, char: 5, spec: 2, lineage: 0 },

  // ---- Africa -----------------------------------------------------------
  kenya: { n: 1100, uniq: 5, char: 9, spec: 9, lineage: 2 },
  tanzania: { n: 1100, uniq: 5, char: 9, spec: 8, lineage: 2 },
  uganda: { n: 1050, uniq: 6, char: 10, spec: 5, lineage: 2 },
  rwanda: { n: 700, uniq: 6, char: 9, spec: 3, lineage: 2 },
  ethiopia: { n: 860, uniq: 8, char: 7, spec: 4, lineage: 2 },
  ghana: { n: 750, uniq: 7, char: 8, spec: 3, lineage: 2 },
  kruger: { n: 500, uniq: 4, char: 8, spec: 5, lineage: 1 },
  botswana: { n: 590, uniq: 4, char: 9, spec: 8, lineage: 1 },
  namibia: { n: 650, uniq: 5, char: 7, spec: 6, lineage: 1 },
  zambia: { n: 750, uniq: 4, char: 8, spec: 6, lineage: 1 },
  zimbabwe: { n: 670, uniq: 4, char: 8, spec: 5, lineage: 1 },
  // Five endemic families — mesites, ground-rollers, cuckoo-roller, asities
  // and vangas — plus couas. Whole branches of the tree, nowhere else.
  madagascar: { n: 290, uniq: 10, char: 9, spec: 2, lineage: 10 },
  // Sugarbirds are an endemic family; the fynbos endemics are a real draw.
  'cape-town': { n: 400, uniq: 8, char: 7, spec: 5, lineage: 5 },
  seychelles: { n: 60, uniq: 9, char: 7, spec: 6, lineage: 3 },
  mauritius: { n: 60, uniq: 8, char: 6, spec: 2, lineage: 3 },

  // ---- Asia -------------------------------------------------------------
  borneo: { n: 530, uniq: 8, char: 9, spec: 3, lineage: 3 },
  srilanka: { n: 450, uniq: 8, char: 8, spec: 3, lineage: 3 },
  bhutan: { n: 700, uniq: 6, char: 8, spec: 6, lineage: 1 },
  nepal: { n: 880, uniq: 4, char: 7, spec: 4, lineage: 1 },
  vietnam: { n: 900, uniq: 6, char: 7, spec: 2, lineage: 1 },
  taiwan: { n: 620, uniq: 7, char: 7, spec: 5, lineage: 2 },
  kaziranga: { n: 480, uniq: 5, char: 8, spec: 5, lineage: 1 },
  kerala: { n: 500, uniq: 6, char: 7, spec: 3, lineage: 2 },
  'rajasthan-golden-triangle': { n: 450, uniq: 4, char: 8, spec: 9, lineage: 0 },
  ladakh: { n: 300, uniq: 5, char: 6, spec: 3, lineage: 0 },
  hokkaido: { n: 350, uniq: 4, char: 10, spec: 9, lineage: 0 },
  palawan: { n: 280, uniq: 8, char: 7, spec: 2, lineage: 2 },
  // Birds-of-paradise, but the family is shared with New Guinea proper.
  rajaampat: { n: 200, uniq: 8, char: 9, spec: 3, lineage: 6 },
  komodo: { n: 150, uniq: 5, char: 6, spec: 2, lineage: 1 },
  bali: { n: 300, uniq: 5, char: 6, spec: 2, lineage: 1 },
  thailand: { n: 300, uniq: 3, char: 5, spec: 2, lineage: 0 },
  bangkok: { n: 380, uniq: 2, char: 6, spec: 5, lineage: 0 },
  angkor: { n: 350, uniq: 3, char: 7, spec: 6, lineage: 0 },
  bagan: { n: 250, uniq: 2, char: 5, spec: 3, lineage: 0 },
  luangprabang: { n: 350, uniq: 3, char: 5, spec: 2, lineage: 0 },
  hongkong: { n: 550, uniq: 2, char: 7, spec: 7, lineage: 0 },
  singapore: { n: 400, uniq: 2, char: 6, spec: 5, lineage: 0 },
  // Birds-of-paradise and bowerbirds: two whole families, and the reason
  // people cross the world for a comparatively modest species list.
  'papua-new-guinea': { n: 700, uniq: 10, char: 10, spec: 3, lineage: 10 },
  mongolia: { n: 470, uniq: 4, char: 6, spec: 4, lineage: 0 },
  dubai: { n: 320, uniq: 2, char: 5, spec: 5, lineage: 0 },
  egypt: { n: 480, uniq: 2, char: 6, spec: 6, lineage: 0 },
  jordan: { n: 430, uniq: 3, char: 5, spec: 5, lineage: 0 },
  uluru: { n: 180, uniq: 6, char: 5, spec: 2, lineage: 3 },

  // ---- Europe & the North ----------------------------------------------
  iceland: { n: 85, uniq: 4, char: 10, spec: 10, lineage: 0 },
  'faroe-islands': { n: 50, uniq: 2, char: 8, spec: 10, lineage: 0 },
  lofoten: { n: 90, uniq: 2, char: 8, spec: 9, lineage: 0 },
  svalbard: { n: 30, uniq: 4, char: 9, spec: 8, lineage: 0 },
  antarctica: { n: 20, uniq: 6, char: 10, spec: 10, lineage: 3 },
  azores: { n: 40, uniq: 4, char: 6, spec: 6, lineage: 1 },
  madeira: { n: 40, uniq: 6, char: 6, spec: 5, lineage: 1 },
  canaries: { n: 100, uniq: 6, char: 5, spec: 3, lineage: 1 },
  morocco: { n: 500, uniq: 4, char: 7, spec: 9, lineage: 0 },
  algarve: { n: 320, uniq: 3, char: 7, spec: 9, lineage: 0 },
  mallorca: { n: 330, uniq: 3, char: 6, spec: 5, lineage: 0 },
  'scottish-highlands-skye': { n: 250, uniq: 3, char: 7, spec: 6, lineage: 0 },
  'great-smoky-mountains': { n: 240, uniq: 3, char: 5, spec: 4, lineage: 0 },
  churchill: { n: 200, uniq: 5, char: 8, spec: 8, lineage: 0 },
  'denali-interior': { n: 170, uniq: 2, char: 6, spec: 3, lineage: 0 },
  yellowstone: { n: 300, uniq: 2, char: 7, spec: 4, lineage: 0 },
  everglades: { n: 360, uniq: 4, char: 9, spec: 9, lineage: 0 },
  'monterey-big-sur': { n: 350, uniq: 3, char: 7, spec: 8, lineage: 0 },
  'vancouver-island': { n: 300, uniq: 2, char: 7, spec: 7, lineage: 0 },
  'southeast-alaska': { n: 250, uniq: 2, char: 8, spec: 8, lineage: 0 },
  'nova-scotia': { n: 300, uniq: 2, char: 5, spec: 5, lineage: 0 },
  acadia: { n: 300, uniq: 2, char: 5, spec: 4, lineage: 0 },
  banff: { n: 260, uniq: 2, char: 5, spec: 3, lineage: 0 },
  'glacier-waterton': { n: 270, uniq: 2, char: 5, spec: 3, lineage: 0 },
  olympic: { n: 300, uniq: 2, char: 5, spec: 3, lineage: 0 },
  yosemite: { n: 260, uniq: 2, char: 5, spec: 3, lineage: 0 },
  'upper-peninsula': { n: 300, uniq: 2, char: 5, spec: 5, lineage: 0 },
  'badlands-black-hills': { n: 280, uniq: 3, char: 5, spec: 3, lineage: 0 },
  'new-orleans': { n: 420, uniq: 2, char: 6, spec: 8, lineage: 0 },
  'texas-hill-country': { n: 450, uniq: 5, char: 6, spec: 3, lineage: 0 },
  gbr: { n: 250, uniq: 4, char: 7, spec: 6, lineage: 1 },
  tasmania: { n: 230, uniq: 7, char: 6, spec: 4, lineage: 6 },
  // Kiwi and the New Zealand wrens are endemic families; moa-order remnants.
  'north-island': { n: 200, uniq: 9, char: 7, spec: 3, lineage: 9 },
  'milford-sound-fiordland': { n: 160, uniq: 9, char: 7, spec: 3, lineage: 9 },
  queenstown: { n: 150, uniq: 8, char: 6, spec: 2, lineage: 6 },
  sydney: { n: 400, uniq: 6, char: 7, spec: 3, lineage: 2 },
  fiji: { n: 110, uniq: 7, char: 6, spec: 2, lineage: 2 },
  maldives: { n: 120, uniq: 2, char: 4, spec: 3, lineage: 0 },
};

/** 50/25/25 on the base, then two independent multiplicative bonuses. */
function modelScore(r: Row): number {
  const base = 0.5 * countScore(r.n) + 0.25 * r.uniq + 0.25 * r.char;
  return Math.min(10, base * (1 + 0.25 * (r.spec / 10)) * (1 + 0.25 * (r.lineage / 10)));
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
          `n${String(o.r.n).padStart(4)}(c${countScore(o.r.n).toFixed(1)}) u${o.r.uniq} ch${o.r.char} sp${o.r.spec} lin${o.r.lineage}   ${o.name}`,
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
