// One-time seed for the per-interest admin pages (Oct 2026). Safe to re-run: it
// only fills facts that are still empty and skips rows that already exist, so it
// never overwrites anything typed through the admin page.
//
// Facts for birding come from two files that predate the admin page:
//   docs/birding-draw-birds.json            draw rating, headline birds, source-checked (all 200 places)
//   scripts/data/birding-model-inputs.json  species, charisma, spectacle (+ endemism / lineage ratings) for 107 places
// plus the three views/photo ratings given on 2026-10-05.
//
// Usage: npx tsx scripts/seed-interest-pages.ts
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

const REVIEW_URL = 'https://claude.ai/artifact/KxRJyPP44P58KkAzom9owL';

const TODOS: Array<{ title: string; detail: string; status: 'needs_you' | 'ready_for_claude' | 'idea'; source: string }> = [
  { status: 'needs_you', title: 'Approve or edit the confirmed fixes from the specialist review', detail: '16 places with verified errors: Serengeti & Zanzibar (species total, lovebird), Papua New Guinea (species total), Madagascar (six endemic families), Denali (park road closed past Mile 43), Great Barrier Reef (Raine Island closed), Maui (Kiwikiu), Ghana (Egyptian Plover site, overview over cap), Canary Islands (Houbara season), Mexico City (Black-polled Yellowthroat), Tierra del Fuego (Useless Bay penguins), Vermont (toll road hours), Black Forest (capercaillie display grounds), Edinburgh (winter Bass Rock tours), Norwegian Fjords (midnight sun), Hokkaido (Blakiston\'s Fish-Owl), Everglades ("guaranteed").', source: `Birding specialist review, 5 Oct 2026 — ${REVIEW_URL}` },
  { status: 'needs_you', title: 'Decide the 12 score-tier questions', detail: 'Peaks that look high against the birding model: Seychelles, Azores, Madeira, Canary Islands, Tierra del Fuego, El Chaltén, Svalbard, Faroe Islands, Denali, Glacier & Waterton. Look low: Milford Sound & Fiordland, Queenstown. The review lists a suggested peak for each.', source: `Birding specialist review, 5 Oct 2026 — ${REVIEW_URL}` },
  { status: 'needs_you', title: 'Approve the 13 species-name fixes found in the review', detail: 'Western Swamphen, Iberian Magpie, Cinereous Vulture (Mallorca), Canada Jay, Western Flycatcher, Great Frigatebird, Common Merganser, Gray-headed Fish-Eagle, Gray Crowned-Crane.', source: `Birding specialist review, 5 Oct 2026 — ${REVIEW_URL}` },
  { status: 'needs_you', title: 'Approve the wording sweep drafts', detail: '"Premier" in 6 places, "irruptive" in 2, "passerine" in 8, and softening "virtually guaranteed" where it is used for common birds.', source: `Birding specialist review, 5 Oct 2026 — ${REVIEW_URL}` },
  { status: 'needs_you', title: 'Decide the five open bird-name calls', detail: "Bewick's Swan, Eurasian Teal (eBird has only Green-winged Teal), Steppe Buzzard, the Bora Bora white terns, and whether Citrine White-eye becomes Caroline Islands White-eye in Palau.", source: 'Species name review, Oct 2026' },
  { status: 'ready_for_claude', title: 'Re-run the eBird-name sweep on the 200 live texts', detail: 'The earlier list of about 300 plain renames (Grey Heron to Gray Heron, Common Starling to European Starling) was built before 200 new texts went live. It needs regenerating, then your approval.', source: 'Species name review, Oct 2026' },
  { status: 'ready_for_claude', title: 'Trim the 10 overviews that are over their length cap', detail: 'Ghana 513/450, Texas Hill Country 466/450, Finnish Lapland 463/450, North Island 460/450, Great Smoky Mountains 454/450, Galápagos 453/450, Zion & Bryce 405/380, Sedona 394/380, Havana 389/380, Thailand 388/380.', source: `Birding specialist review, 5 Oct 2026 — ${REVIEW_URL}` },
  { status: 'ready_for_claude', title: 'Re-run the audit for the 9 places that returned nothing', detail: 'Badlands & Black Hills, Barbados, Budapest, Chamonix, Charleston & Savannah, Komodo, Finnish Lapland, Rwanda, Victoria Falls & Hwange. Costs a few cents.', source: `Birding specialist review, 5 Oct 2026 — ${REVIEW_URL}` },
  { status: 'idea', title: 'Fill the empty data columns', detail: 'Endemic species, endemic families and views/photo for every place, and species counts for the 93 places with none. Species, charisma and spectacle for 107 places came from the old model script.', source: 'Interest page build, 5 Oct 2026' },
  { status: 'idea', title: 'Collect the planning columns', detail: 'Days needed, guide or self-drive, how spread out, accessibility. These make the two-place comparison answer "which is easier to plan".', source: 'Interest page build, 5 Oct 2026' },
  { status: 'idea', title: 'Source-check the draw birds', detail: 'Only 55 of 200 places have headline birds marked as checked against a source.', source: 'Draw-bird data' },
  { status: 'idea', title: 'Correct "five endemic families" for Madagascar in the directive and model script', detail: 'The Malagasy warblers (Bernieridae) make six. Live text is already proposed in the review.', source: `Birding specialist review, 5 Oct 2026 — ${REVIEW_URL}` },
];

const IDEAS: Array<{ name: string; region: string; why: string; nearestExisting: string }> = [
  { name: 'Extremadura', region: 'Spain', why: 'Spanish Imperial Eagle, Great Bustard and wintering Common Cranes in one dry-oak landscape. (Seed idea, not yet researched.)', nearestExisting: 'Andalucía' },
  { name: 'Danube Delta', region: 'Romania', why: 'Dalmatian and Great White Pelican colonies and a very large wetland list. (Seed idea, not yet researched.)', nearestExisting: 'Budapest' },
  { name: 'Hula Valley & Eilat', region: 'Israel', why: 'A major migration bottleneck between Europe, Asia and Africa, with large crane wintering. (Seed idea, not yet researched.)', nearestExisting: 'Egypt, Jordan' },
  { name: 'Cape May', region: 'New Jersey, USA', why: 'Autumn songbird and raptor migration funnels onto a peninsula tip. (Seed idea, not yet researched.)', nearestExisting: 'Everglades' },
  { name: 'Southeast Arizona sky islands', region: 'Arizona, USA', why: 'Mexican specialties such as trogons and many hummingbird species close to the border. (Seed idea, not yet researched.)', nearestExisting: 'Sedona' },
  { name: 'Trinidad & Tobago', region: 'Caribbean', why: 'South American birds on a small, easy island, including a famous Scarlet Ibis roost. (Seed idea, not yet researched.)', nearestExisting: 'Jamaica' },
  { name: 'The Gambia', region: 'West Africa', why: 'Compact, easy introduction to West African birding with a large list for its size. (Seed idea, not yet researched.)', nearestExisting: 'Ghana' },
  { name: 'Guyana', region: 'South America', why: 'Guiana Shield specialists and large intact forest. (Seed idea, not yet researched.)', nearestExisting: 'Peruvian Amazon' },
  { name: 'Sulawesi', region: 'Indonesia', why: 'Very high endemism, distinct from nearby Borneo. (Seed idea, not yet researched.)', nearestExisting: 'Borneo' },
];

async function main() {
  loadEnv();
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, interestTodos, interestPlaceIdeas, interestReviews, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');

  const draw = JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'birding-draw-birds.json'), 'utf8')) as Array<{ id: string; birdingDraw: string; confidence: string; sourceChecked: boolean; drawBirds: string[] }>;
  const model = JSON.parse(readFileSync(join(__dirname, 'data', 'birding-model-inputs.json'), 'utf8')) as Array<{ id: string; n: number; u: number; c: number; s: number; l: number }>;
  const views: Record<string, number> = { 'ecuadorian-andes': 10, 'costa-rica': 10, galapagos: 8 };

  const known = new Set((await db.select({ id: places.id }).from(places)).map((p) => p.id));
  const byId = new Map<string, Record<string, string | number | boolean | string[]>>();
  const put = (id: string, k: string, v: string | number | boolean | string[]) => byId.set(id, { ...(byId.get(id) ?? {}), [k]: v });
  for (const d of draw) {
    if (!known.has(d.id)) continue;
    put(d.id, 'draw', d.birdingDraw);
    put(d.id, 'headlineBirds', d.drawBirds);
    put(d.id, 'drawSourceChecked', d.sourceChecked);
    put(d.id, 'drawConfidence', d.confidence);
  }
  for (const m of model) {
    if (!known.has(m.id)) continue;
    put(m.id, 'species', m.n);
    put(m.id, 'charisma', m.c);
    put(m.id, 'spectacle', m.s);
    put(m.id, 'endemismRating', m.u);
    put(m.id, 'lineageRating', m.l);
  }
  for (const [id, v] of Object.entries(views)) if (known.has(id)) put(id, 'viewsPhoto', v);

  let factRows = 0;
  for (const [placeId, seed] of byId) {
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'birding')));
    const facts = { ...(existing?.facts ?? {}) } as Record<string, unknown>;
    let changed = false;
    for (const [k, v] of Object.entries(seed)) if (facts[k] === undefined) { facts[k] = v; changed = true; }
    if (!changed) continue;
    await db.insert(placeInterestFacts).values({ placeId, interestKey: 'birding', facts: facts as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    factRows++;
  }

  const haveTodos = new Set((await db.select({ t: interestTodos.title }).from(interestTodos).where(eq(interestTodos.interestKey, 'birding'))).map((r) => r.t));
  let todoRows = 0;
  for (const t of TODOS) if (!haveTodos.has(t.title)) { await db.insert(interestTodos).values({ interestKey: 'birding', ...t }); todoRows++; }

  const haveIdeas = new Set((await db.select({ n: interestPlaceIdeas.name }).from(interestPlaceIdeas).where(eq(interestPlaceIdeas.interestKey, 'birding'))).map((r) => r.n));
  let ideaRows = 0;
  for (const i of IDEAS) if (!haveIdeas.has(i.name)) { await db.insert(interestPlaceIdeas).values({ interestKey: 'birding', ...i }); ideaRows++; }

  const haveReview = await db.select({ id: interestReviews.id }).from(interestReviews).where(and(eq(interestReviews.interestKey, 'birding'), eq(interestReviews.reviewerName, 'Claude (AI)'), eq(interestReviews.reviewedOn, '2026-10-05')));
  let reviewRows = 0;
  if (haveReview.length === 0) {
    await db.insert(interestReviews).values({
      interestKey: 'birding',
      placeId: null,
      reviewerName: 'Claude (AI)',
      reviewerRole: 'AI-assisted specialist review pass',
      reviewedOn: '2026-10-05',
      createdBy: 'seed script',
      notes: `Read all 200 live birding texts with a Gemini Flash audit ($0.57), then checked about two dozen of the flagged claims against park, operator, checklist and taxonomy sources and every proposed species name against the eBird/Clements taxonomy. Found 16 places with confirmed errors, 13 name fixes, wording-rule breaches and 12 score-tier questions; Gemini was wrong on about ten flags I checked. Nothing was changed in the app; drafts are in the review: ${REVIEW_URL}`,
    });
    reviewRows++;
  }

  console.log(`Seeded: ${factRows} fact rows, ${todoRows} outstanding items, ${ideaRows} place ideas, ${reviewRows} review.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
