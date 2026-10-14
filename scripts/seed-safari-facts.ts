// Draft facts for the Safari admin page (Oct 2026). Safe to re-run: it only fills cells that are still empty,
// so nothing typed on the admin page is ever overwritten.
//
// Only cells that could be filled with confidence are filled; everything else is left blank on purpose.
// Sources: docs/safari-facts.json (checked against park and operator sources) plus general knowledge for
// species presence and malaria zones. Every row is stored with drawSourceChecked = false; the whole grid is
// a first draft and is listed as an outstanding item for checking.
//
// Likelihood scale (best season, 3 to 4 day visit): G guaranteed (95%+), L likely (70-95), P possible (25-70),
// U unlikely (<25), N not present.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-safari-facts.ts
import { readFileSync } from 'fs';
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

const LK: Record<string, string> = { G: 'guaranteed', L: 'likely', P: 'possible', U: 'unlikely', N: 'notPresent' };
const ANIMALS = ['lion', 'leopard', 'elephant', 'rhino', 'cheetah', 'wildDog', 'giraffe', 'hippo', 'herds', 'tiger'] as const;
type Animal = (typeof ANIMALS)[number];

// order: lion leopard elephant rhino cheetah wildDog giraffe hippo herds tiger ('-' = leave blank)
// Jaguar moved out of the grid into the Other megafauna column on 6 Oct 2026.
const GRID: Record<string, string> = {
  kruger: 'L P G L P U G G - N',
  kenya: 'L P G U L U G G G N',
  tanzania: 'G L L U L U G G G N',
  botswana: 'L L G U P P L G - N',
  zambia: 'L L G N U P G G - N',
  zimbabwe: 'L P G U P P G L - N',
  namibia: 'L P G L P U G P - N',
  uganda: 'P U G U U N G G - N',
  rwanda: 'P U L U N N L G - N',
  ethiopia: 'U U U N N N - G - N',
  ghana: 'U U L N N N N - - N',
  nepal: 'N U P L N N N N - P',
  kaziranga: 'N U L G N N N N - U',
  'rajasthan-golden-triangle': 'N U N N N - N N - L',
  srilanka: 'N L G N N N N N L N',
  pantanal: 'N N N N N N N N - N',
  borneo: 'N N P N N N N N - N',
};

type Row = Record<string, string>;
const STYLE: Record<string, Row> = {
  kruger: { selfDrive: 'yes', walking: 'yes', nightDrives: 'yes', boat: 'no', landModel: 'mix', access: 'road' },
  kenya: { walking: 'limited', boat: 'no', landModel: 'mix', access: 'mixed' },
  tanzania: { boat: 'no', landModel: 'nationalPark', access: 'mixed' },
  botswana: { selfDrive: 'partly', walking: 'yes', nightDrives: 'yes', offRoad: 'yes', boat: 'yes', landModel: 'privateConcessions', access: 'flyIn' },
  zambia: { walking: 'yes', nightDrives: 'yes', landModel: 'nationalPark', access: 'mixed' },
  zimbabwe: { selfDrive: 'yes', walking: 'yes', nightDrives: 'yes', boat: 'yes', landModel: 'nationalPark', access: 'road' },
  namibia: { selfDrive: 'yes', walking: 'no', nightDrives: 'yes', offRoad: 'no', boat: 'no', landModel: 'nationalPark', access: 'road' },
  uganda: { selfDrive: 'partly', walking: 'limited', boat: 'yes', landModel: 'nationalPark', access: 'road' },
  rwanda: { selfDrive: 'partly', boat: 'yes', landModel: 'nationalPark', access: 'road' },
  ethiopia: { boat: 'yes', landModel: 'nationalPark', access: 'road' },
  ghana: { walking: 'yes', landModel: 'nationalPark', access: 'road' },
  nepal: { selfDrive: 'no', walking: 'yes', nightDrives: 'no', offRoad: 'no', boat: 'yes', landModel: 'nationalPark', access: 'road' },
  kaziranga: { selfDrive: 'no', walking: 'no', nightDrives: 'no', offRoad: 'no', boat: 'no', landModel: 'nationalPark', access: 'road' },
  'rajasthan-golden-triangle': { selfDrive: 'no', walking: 'no', nightDrives: 'no', offRoad: 'no', boat: 'no', landModel: 'nationalPark', access: 'road' },
  srilanka: { selfDrive: 'no', walking: 'no', nightDrives: 'no', offRoad: 'no', landModel: 'nationalPark', access: 'road' },
  pantanal: { selfDrive: 'partly', boat: 'yes', access: 'road' },
  borneo: { selfDrive: 'no', nightDrives: 'yes', boat: 'yes', access: 'road' },
};


// Other megafauna, drafted 6 Oct 2026 under the owner's rules: apes yes, monkeys no, small animals no, buffalo and
// crocodilians only where they are a top-five reason to go, scope literal to the place name, same five likelihood words.
// Unverified drafts.
const OTHER: Record<string, string> = {
  kruger: 'Buffalo (guaranteed)',
  uganda: 'Mountain gorilla (guaranteed, habituated), Chimpanzee (likely, habituated)',
  rwanda: 'Mountain gorilla (guaranteed, habituated), Chimpanzee (likely, habituated)',
  ethiopia: 'Ethiopian wolf (possible)',
  nepal: 'Gharial (likely), Sloth bear (unlikely)',
  kaziranga: 'Wild water buffalo (guaranteed), Gaur (unlikely)',
  'rajasthan-golden-triangle': 'Sloth bear (possible)',
  srilanka: 'Sloth bear (possible)',
  pantanal: 'Jaguar (guaranteed), Giant river otter (likely), Capybara (guaranteed), Yacare caiman (guaranteed), Lowland tapir (possible), Giant anteater (possible), Green anaconda (possible)',
  borneo: 'Orangutan (possible), Sun bear (unlikely), Clouded leopard (unlikely)',
};

const CROWDING: Record<string, string> = { kruger: 'medium', kenya: 'high', botswana: 'low', zambia: 'low', zimbabwe: 'low', uganda: 'low', rwanda: 'low', ethiopia: 'low', ghana: 'low', 'rajasthan-golden-triangle': 'high', srilanka: 'high' };

const MALARIA: Record<string, string> = {
  kruger: 'seasonal', kenya: 'high', tanzania: 'high', botswana: 'seasonal', zambia: 'high', zimbabwe: 'seasonal', namibia: 'seasonal',
  uganda: 'high', rwanda: 'high', ethiopia: 'high', ghana: 'high', nepal: 'low', 'rajasthan-golden-triangle': 'low', srilanka: 'none', borneo: 'low',
};

// Strong when the place's peak is 7 or higher, moderate 5 to 6.9, weak below 5 (the calibration ladder).
const DRAW: Record<string, string> = {
  kruger: 'strong', kenya: 'strong', tanzania: 'strong', botswana: 'strong', zambia: 'strong', zimbabwe: 'strong', namibia: 'strong',
  uganda: 'strong', kaziranga: 'strong', 'rajasthan-golden-triangle': 'strong', srilanka: 'strong', pantanal: 'strong',
  rwanda: 'moderate', nepal: 'moderate', borneo: 'moderate', ethiopia: 'weak', ghana: 'weak',
};

const HEADLINE: Record<string, string[]> = {
  kruger: ['Leopard (Sabi Sands)', 'Lion', 'Elephant', 'White rhino'],
  kenya: ['Wildebeest river crossings', 'Lion', 'Cheetah', 'Elephant (Amboseli)'],
  tanzania: ['Wildebeest migration', 'Lion', 'Cheetah', 'Leopard', 'Serval'],
  botswana: ['Elephant', 'African wild dog', 'Lion', 'Leopard'],
  zambia: ['Leopard', 'Lion', 'Hippo', "Thornicroft's giraffe"],
  zimbabwe: ['Elephant', 'Lion', 'African wild dog', 'Cheetah'],
  namibia: ['Black rhino', 'Elephant', 'Lion', 'Giraffe'],
  uganda: ['Tree-climbing lion', 'Elephant', 'Hippo', "Rothschild's giraffe"],
  rwanda: ['Lion', 'Eastern black rhino', 'Elephant', 'Hippo'],
  ethiopia: ['Beisa oryx', "Soemmerring's gazelle", 'Greater kudu', "Burchell's zebra"],
  ghana: ['Elephant'],
  nepal: ['One-horned rhino', 'Bengal tiger', 'Gharial'],
  kaziranga: ['One-horned rhino', 'Wild elephant', 'Wild water buffalo', 'Tiger'],
  'rajasthan-golden-triangle': ['Bengal tiger', 'Sloth bear', 'Leopard'],
  srilanka: ['Asian elephant', 'Leopard', 'Sloth bear'],
  pantanal: ['Jaguar', 'Giant river otter', 'Capybara', 'Caiman'],
  borneo: ['Orangutan', 'Proboscis monkey', 'Pygmy elephant', 'Hornbills'],
};


const TODOS: Array<{ status: 'needs_you' | 'ready_for_claude' | 'idea'; title: string; detail: string }> = [
  { status: 'ready_for_claude', title: 'Verify the draft animal grid, style and malaria columns', detail: 'All 17 places have a first-draft animal grid, style/rules, malaria and draw, from park and operator sources and general knowledge. Nothing is marked source-checked. Highest-risk cells: Zambia rhino and cheetah (left blank), Botswana wild dog, Namibia wild dog and hippo (not present), Rwanda lion and rhino, Ethiopia hippo, Nepal elephant (blank), and every self-drive and night-drive entry.' },
  { status: 'needs_you', title: 'Rate wildlife density, close-up ease and spectacle (0-10)', detail: 'Left blank on purpose: these are judgment calls and should be yours. Spectacle is the migration, calving and gathering rating; close-up ease is how easy it is to get clean views and photos.' },
  { status: 'idea', title: 'Fill the blank cells', detail: 'Cells left blank where the answer was not clear enough to draft: great herds for most places, several self-drive, walking, night-drive, off-road and crowding entries, and malaria for Kaziranga, the Pantanal and Borneo (Sabah has a monkey-borne malaria risk).' },
  { status: 'idea', title: 'Decide whether malaria should become a score input', detail: 'Today it is a planning column only. A seasonal risk in the wet months overlaps the low-season months already scored down.' },
];

async function main() {
  loadEnv();
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, interestTodos, interestReviews, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');

  const known = new Set((await db.select({ id: places.id }).from(places)).map((p) => p.id));
  const seed = new Map<string, Record<string, string | boolean | string[]>>();
  const put = (id: string, k: string, v: string | boolean | string[]) => seed.set(id, { ...(seed.get(id) ?? {}), [k]: v });

  for (const [id, line] of Object.entries(GRID)) {
    const cells = line.split(' ');
    if (cells.length !== ANIMALS.length) throw new Error(`Bad grid row for ${id}`);
    ANIMALS.forEach((a: Animal, i) => { if (cells[i] !== '-') put(id, a, LK[cells[i]]); });
    put(id, 'drawSourceChecked', false);
  }
  for (const [id, row] of Object.entries(STYLE)) for (const [k, v] of Object.entries(row)) put(id, k, v);
  for (const [id, v] of Object.entries(CROWDING)) put(id, 'crowding', v);
  for (const [id, v] of Object.entries(MALARIA)) put(id, 'malaria', v);
  for (const [id, v] of Object.entries(DRAW)) put(id, 'draw', v);
  for (const [id, v] of Object.entries(HEADLINE)) put(id, 'headlineAnimals', v);
  for (const [id, v] of Object.entries(OTHER)) put(id, 'otherMegafauna', v);
  put('kenya', 'selfDrive', 'no');
  put('tanzania', 'selfDrive', 'no');

  let factRows = 0, cells = 0;
  for (const [placeId, s] of seed) {
    if (!known.has(placeId)) { console.log('Skipping unknown place', placeId); continue; }
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'safari')));
    const facts = { ...(existing?.facts ?? {}) } as Record<string, unknown>;
    let changed = false;
    for (const [k, v] of Object.entries(s)) if (facts[k] === undefined) { facts[k] = v; changed = true; cells++; }
    if (!changed) continue;
    await db.insert(placeInterestFacts).values({ placeId, interestKey: 'safari', facts: facts as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    factRows++;
  }

  // Close out the two items this work answers, and add the follow-ups.
  const open = await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'safari'));
  const find = (frag: string) => open.find((t) => t.title.includes(frag));
  const batch = find('staged safari rewrite');
  if (batch && batch.status !== 'done') await db.update(interestTodos).set({ status: 'done', title: 'Safari rewrite applied (17 places)', detail: 'Applied 5 Oct 2026: 17 places live, with your edits to Okavango, Ethiopia, Kruger, Pantanal, Rajasthan, Rwanda, Serengeti and Uganda. Madagascar was already N/A.' }).where(eq(interestTodos.id, batch.id));
  const cols = find('Decide the safari columns');
  if (cols && cols.status !== 'done') await db.update(interestTodos).set({ status: 'done', title: 'Safari columns built', detail: 'Built 5 Oct 2026: eleven-animal likelihood grid (buffalo and crocodile left out), style and rules, experience, malaria, draw and headline animals. Cost, typical days, months closed and family-friendly were left out as you asked.' }).where(eq(interestTodos.id, cols.id));
  const have = new Set(open.map((t) => t.title));
  let todoRows = 0;
  for (const t of TODOS) if (!have.has(t.title)) { await db.insert(interestTodos).values({ interestKey: 'safari', source: 'Safari page build, 5 Oct 2026', ...t }); todoRows++; }

  const haveReview = await db.select({ id: interestReviews.id }).from(interestReviews).where(and(eq(interestReviews.interestKey, 'safari'), eq(interestReviews.reviewerName, 'Claude (AI)'), eq(interestReviews.reviewedOn, '2026-10-05')));
  let reviewRows = 0;
  if (haveReview.length === 0) {
    await db.insert(interestReviews).values({
      interestKey: 'safari', placeId: null, reviewerName: 'Claude (AI)', reviewerRole: 'AI-assisted fact-sheet research', reviewedOn: '2026-10-05', createdBy: 'seed script',
      notes: 'Built verified fact sheets for 17 places from park and operator sources (season windows, closures, access, what each park actually holds), used them to rewrite all 17 overviews and months, then drafted the animal grid and malaria column from the same sheets and general knowledge. The grid is a first draft and is not source-checked.',
    });
    reviewRows++;
  }
  console.log(`Seeded safari: ${factRows} places, ${cells} cells, ${todoRows} new items, ${reviewRows} review.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
