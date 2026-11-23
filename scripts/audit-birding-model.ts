import { readFileSync } from 'fs';
import { join } from 'path';
import { PLACE } from '../src/lib/places/keys.generated';

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
  [PLACE['ecuadorian-andes']]: { n: 1600, uniq: 9, char: 10, spec: 3, lineage: 3 },
  [PLACE['colombian-andes']]: { n: 1000, uniq: 9, char: 10, spec: 3, lineage: 2 },
  [PLACE['cusco-and-sacred-valley']]: { n: 1000, uniq: 8, char: 9, spec: 4, lineage: 2 },
  [PLACE['peruvian-amazon']]: { n: 600, uniq: 7, char: 10, spec: 6, lineage: 2 },
  [PLACE['costa-rica']]: { n: 920, uniq: 6, char: 10, spec: 3, lineage: 1 },
  [PLACE.panama]: { n: 1000, uniq: 6, char: 9, spec: 6, lineage: 1 },
  [PLACE.pantanal]: { n: 450, uniq: 5, char: 10, spec: 9, lineage: 1 },
  [PLACE['colombian-caribbean']]: { n: 600, uniq: 8, char: 8, spec: 2, lineage: 1 },
  [PLACE.chiapas]: { n: 660, uniq: 6, char: 8, spec: 2, lineage: 0 },
  [PLACE.guatemala]: { n: 750, uniq: 6, char: 8, spec: 2, lineage: 0 },
  [PLACE.oaxaca]: { n: 700, uniq: 7, char: 7, spec: 2, lineage: 0 },
  [PLACE.belize]: { n: 590, uniq: 4, char: 8, spec: 3, lineage: 0 },
  [PLACE.nicaragua]: { n: 700, uniq: 4, char: 7, spec: 2, lineage: 0 },
  [PLACE['mexico-city']]: { n: 350, uniq: 4, char: 6, spec: 3, lineage: 0 },
  // Darwin's finches are a radiation rather than a family, but the islands
  // are the textbook case of endemic lineage and hold endemic genera.
  [PLACE['galapagos-islands']]: { n: 60, uniq: 10, char: 9, spec: 8, lineage: 8 },
  [PLACE['argentine-lake-district']]: { n: 250, uniq: 4, char: 6, spec: 2, lineage: 1 },
  [PLACE['chilean-lake-district']]: { n: 250, uniq: 4, char: 6, spec: 2, lineage: 1 },
  [PLACE['torres-del-paine']]: { n: 120, uniq: 4, char: 7, spec: 3, lineage: 1 },
  [PLACE['tierra-del-fuego']]: { n: 120, uniq: 4, char: 6, spec: 3, lineage: 1 },
  [PLACE['el-chalten-and-el-calafate']]: { n: 120, uniq: 4, char: 6, spec: 2, lineage: 1 },
  [PLACE.mendoza]: { n: 250, uniq: 3, char: 5, spec: 2, lineage: 0 },
  [PLACE['salar-de-uyuni']]: { n: 80, uniq: 5, char: 8, spec: 7, lineage: 0 },
  [PLACE['atacama-desert']]: { n: 130, uniq: 5, char: 7, spec: 5, lineage: 0 },
  [PLACE['falkland-islands']]: { n: 60, uniq: 6, char: 10, spec: 10, lineage: 3 },
  [PLACE['puerto-rico']]: { n: 350, uniq: 6, char: 6, spec: 2, lineage: 1 },
  [PLACE.barbados]: { n: 230, uniq: 3, char: 5, spec: 2, lineage: 0 },

  // ---- Africa -----------------------------------------------------------
  [PLACE['maasai-mara-and-amboseli']]: { n: 1100, uniq: 5, char: 9, spec: 9, lineage: 2 },
  [PLACE['northern-tanzania']]: { n: 1100, uniq: 5, char: 9, spec: 8, lineage: 2 },
  [PLACE.uganda]: { n: 1050, uniq: 6, char: 10, spec: 5, lineage: 2 },
  [PLACE.rwanda]: { n: 700, uniq: 6, char: 9, spec: 3, lineage: 2 },
  [PLACE.ethiopia]: { n: 860, uniq: 8, char: 7, spec: 4, lineage: 2 },
  [PLACE.ghana]: { n: 750, uniq: 7, char: 8, spec: 3, lineage: 2 },
  [PLACE['kruger-and-sabi-sands']]: { n: 500, uniq: 4, char: 8, spec: 5, lineage: 1 },
  [PLACE['okavango-delta']]: { n: 590, uniq: 4, char: 9, spec: 8, lineage: 1 },
  [PLACE.namibia]: { n: 650, uniq: 5, char: 7, spec: 6, lineage: 1 },
  [PLACE['south-luangwa']]: { n: 750, uniq: 4, char: 8, spec: 6, lineage: 1 },
  [PLACE['victoria-falls-and-hwange']]: { n: 670, uniq: 4, char: 8, spec: 5, lineage: 1 },
  // Five endemic families — mesites, ground-rollers, cuckoo-roller, asities
  // and vangas — plus couas. Whole branches of the tree, nowhere else.
  [PLACE.madagascar]: { n: 290, uniq: 10, char: 9, spec: 2, lineage: 10 },
  // Sugarbirds are an endemic family; the fynbos endemics are a real draw.
  [PLACE['cape-town']]: { n: 400, uniq: 8, char: 7, spec: 5, lineage: 5 },
  [PLACE.seychelles]: { n: 60, uniq: 9, char: 7, spec: 6, lineage: 3 },
  [PLACE.mauritius]: { n: 60, uniq: 8, char: 6, spec: 2, lineage: 3 },

  // ---- Asia -------------------------------------------------------------
  [PLACE['malaysian-borneo']]: { n: 530, uniq: 8, char: 9, spec: 3, lineage: 3 },
  [PLACE['sri-lanka']]: { n: 450, uniq: 8, char: 8, spec: 3, lineage: 3 },
  [PLACE.bhutan]: { n: 700, uniq: 6, char: 8, spec: 6, lineage: 1 },
  [PLACE.nepal]: { n: 880, uniq: 4, char: 7, spec: 4, lineage: 1 },
  [PLACE.vietnam]: { n: 900, uniq: 6, char: 7, spec: 2, lineage: 1 },
  [PLACE.taiwan]: { n: 620, uniq: 7, char: 7, spec: 5, lineage: 2 },
  [PLACE['assam-and-northeast-india']]: { n: 480, uniq: 5, char: 8, spec: 5, lineage: 1 },
  [PLACE.kerala]: { n: 500, uniq: 6, char: 7, spec: 3, lineage: 2 },
  [PLACE['rajasthan-and-the-golden-triangle']]: { n: 450, uniq: 4, char: 8, spec: 9, lineage: 0 },
  [PLACE.ladakh]: { n: 300, uniq: 5, char: 6, spec: 3, lineage: 0 },
  [PLACE.hokkaido]: { n: 350, uniq: 4, char: 10, spec: 9, lineage: 0 },
  [PLACE.palawan]: { n: 280, uniq: 8, char: 7, spec: 2, lineage: 2 },
  // Birds-of-paradise, but the family is shared with New Guinea proper.
  [PLACE['raja-ampat']]: { n: 200, uniq: 8, char: 9, spec: 3, lineage: 6 },
  [PLACE['komodo-and-flores']]: { n: 150, uniq: 5, char: 6, spec: 2, lineage: 1 },
  [PLACE.bali]: { n: 300, uniq: 5, char: 6, spec: 2, lineage: 1 },
  [PLACE['phuket-and-the-andaman-coast']]: { n: 300, uniq: 3, char: 5, spec: 2, lineage: 0 },
  [PLACE.bangkok]: { n: 380, uniq: 2, char: 6, spec: 5, lineage: 0 },
  [PLACE.cambodia]: { n: 350, uniq: 3, char: 7, spec: 6, lineage: 0 },
  [PLACE.myanmar]: { n: 250, uniq: 2, char: 5, spec: 3, lineage: 0 },
  [PLACE.laos]: { n: 350, uniq: 3, char: 5, spec: 2, lineage: 0 },
  [PLACE['hong-kong']]: { n: 550, uniq: 2, char: 7, spec: 7, lineage: 0 },
  [PLACE.singapore]: { n: 400, uniq: 2, char: 6, spec: 5, lineage: 0 },
  // Birds-of-paradise and bowerbirds: two whole families, and the reason
  // people cross the world for a comparatively modest species list.
  [PLACE['papua-new-guinea']]: { n: 700, uniq: 10, char: 10, spec: 3, lineage: 10 },
  [PLACE.mongolia]: { n: 470, uniq: 4, char: 6, spec: 4, lineage: 0 },
  [PLACE.dubai]: { n: 320, uniq: 2, char: 5, spec: 5, lineage: 0 },
  [PLACE['red-sea-and-nile']]: { n: 480, uniq: 2, char: 6, spec: 6, lineage: 0 },
  [PLACE['petra-and-wadi-rum']]: { n: 430, uniq: 3, char: 5, spec: 5, lineage: 0 },
  [PLACE['uluru-and-the-outback']]: { n: 180, uniq: 6, char: 5, spec: 2, lineage: 3 },

  // ---- Europe & the North ----------------------------------------------
  [PLACE.iceland]: { n: 85, uniq: 4, char: 10, spec: 10, lineage: 0 },
  [PLACE['faroe-islands']]: { n: 50, uniq: 2, char: 8, spec: 10, lineage: 0 },
  [PLACE['lofoten-islands']]: { n: 90, uniq: 2, char: 8, spec: 9, lineage: 0 },
  [PLACE.svalbard]: { n: 30, uniq: 4, char: 9, spec: 8, lineage: 0 },
  [PLACE['antarctic-peninsula']]: { n: 20, uniq: 6, char: 10, spec: 10, lineage: 3 },
  [PLACE.azores]: { n: 40, uniq: 4, char: 6, spec: 6, lineage: 1 },
  [PLACE.madeira]: { n: 40, uniq: 6, char: 6, spec: 5, lineage: 1 },
  [PLACE['canary-islands']]: { n: 100, uniq: 6, char: 5, spec: 3, lineage: 1 },
  [PLACE['marrakech-and-atlas']]: { n: 500, uniq: 4, char: 7, spec: 9, lineage: 0 },
  [PLACE.algarve]: { n: 320, uniq: 3, char: 7, spec: 9, lineage: 0 },
  [PLACE.mallorca]: { n: 330, uniq: 3, char: 6, spec: 5, lineage: 0 },
  [PLACE['scottish-highlands-and-isle-of-skye']]: { n: 250, uniq: 3, char: 7, spec: 6, lineage: 0 },
  [PLACE['great-smoky-mountains-national-park']]: { n: 240, uniq: 3, char: 5, spec: 4, lineage: 0 },
  [PLACE.churchill]: { n: 200, uniq: 5, char: 8, spec: 8, lineage: 0 },
  [PLACE['denali-and-the-interior']]: { n: 170, uniq: 2, char: 6, spec: 3, lineage: 0 },
  [PLACE['yellowstone-national-park']]: { n: 300, uniq: 2, char: 7, spec: 4, lineage: 0 },
  [PLACE['everglades-national-park']]: { n: 360, uniq: 4, char: 9, spec: 9, lineage: 0 },
  [PLACE['monterey-and-big-sur']]: { n: 350, uniq: 3, char: 7, spec: 8, lineage: 0 },
  [PLACE['vancouver-island']]: { n: 300, uniq: 2, char: 7, spec: 7, lineage: 0 },
  [PLACE['southeast-alaska-and-the-inside-passage']]: { n: 250, uniq: 2, char: 8, spec: 8, lineage: 0 },
  [PLACE['nova-scotia']]: { n: 300, uniq: 2, char: 5, spec: 5, lineage: 0 },
  [PLACE['acadia-national-park']]: { n: 300, uniq: 2, char: 5, spec: 4, lineage: 0 },
  [PLACE['banff-and-jasper-national-parks']]: { n: 260, uniq: 2, char: 5, spec: 3, lineage: 0 },
  [PLACE['glacier-and-waterton-lakes']]: { n: 270, uniq: 2, char: 5, spec: 3, lineage: 0 },
  [PLACE['olympic-national-park']]: { n: 300, uniq: 2, char: 5, spec: 3, lineage: 0 },
  [PLACE['yosemite-national-park']]: { n: 260, uniq: 2, char: 5, spec: 3, lineage: 0 },
  [PLACE['upper-peninsula']]: { n: 300, uniq: 2, char: 5, spec: 5, lineage: 0 },
  [PLACE['badlands-and-black-hills']]: { n: 280, uniq: 3, char: 5, spec: 3, lineage: 0 },
  [PLACE['new-orleans']]: { n: 420, uniq: 2, char: 6, spec: 8, lineage: 0 },
  [PLACE['texas-hill-country']]: { n: 450, uniq: 5, char: 6, spec: 3, lineage: 0 },
  [PLACE['great-barrier-reef']]: { n: 250, uniq: 4, char: 7, spec: 6, lineage: 1 },
  [PLACE.tasmania]: { n: 230, uniq: 7, char: 6, spec: 4, lineage: 6 },
  // Kiwi and the New Zealand wrens are endemic families; moa-order remnants.
  [PLACE['north-island']]: { n: 200, uniq: 9, char: 7, spec: 3, lineage: 9 },
  [PLACE['milford-sound-and-fiordland']]: { n: 160, uniq: 9, char: 7, spec: 3, lineage: 9 },
  [PLACE.queenstown]: { n: 150, uniq: 8, char: 6, spec: 2, lineage: 6 },
  [PLACE.sydney]: { n: 400, uniq: 6, char: 7, spec: 3, lineage: 2 },
  [PLACE.fiji]: { n: 110, uniq: 7, char: 6, spec: 2, lineage: 2 },
  [PLACE.maldives]: { n: 120, uniq: 2, char: 4, spec: 3, lineage: 0 },
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

  const topArg = process.argv.find((a) => a.startsWith('--top='));
  if (topArg) {
    const n = Number(topArg.split('=')[1]);
    console.log(`\n=== Top ${n} candidates, ranked by |gap| regardless of the 1.5 threshold`);
    show([...rows].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, n));
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
