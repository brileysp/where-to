import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'birding';
type Source = { url: string; label?: string; note?: string; addedAt: string };
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCES: Record<string, Source[]> = {
  azores: [
    { url: 'https://azores.com/blog/bird-watching-in-the-azores-which-bird-species-can-you-observe-in-the-azores-archipelago/', label: 'Azores.com', note: 'Confirms Priolo (Azores Bullfinch) endemic and seabird colonies; base score of 0 was indefensible next to every other destination in the catalog', addedAt: TODAY },
    { url: 'https://www.birdquest-tours.com/birding-tours/madeira-azores-portugal/', label: 'Birdquest', addedAt: TODAY },
  ],
  maldives: [
    { url: 'https://www.researchgate.net/publication/356357078_The_importance_of_the_Maldives_as_a_wintering_ground_for_migratory_birds_of_the_Central_Asian_flyway', label: 'ResearchGate — Maldives as a Central Asian Flyway wintering ground', addedAt: TODAY },
  ],
  andalucia: [
    { url: 'https://www.wildandalucia.com/bird-migration-strait-of-gibraltar/', label: 'Wild Andalucia', note: 'Confirms March as one of the two best spring raptor-passage months, missing entirely from the old event', addedAt: TODAY },
  ],
  algarve: [
    { url: 'https://algarvenaturetours.com/bird-watching-highlights-by-season-in-the-algarve/', label: 'Algarve Nature Tours', addedAt: TODAY },
  ],
  athens: [
    { url: 'https://www.greecebirdtours.com/2022/12/athens-europes-best-birding-capital.html', label: 'GreeceBirdTours', note: 'Confirms spring migration runs into June, not just May', addedAt: TODAY },
  ],
  bhutan: [
    { url: 'https://www.birdlife.org/news/2024/11/22/a-himalayan-haven-for-the-black-necked-crane/', label: 'BirdLife International', note: 'Confirms cranes traditionally arrive at Phobjikha in late October, a culturally celebrated date', addedAt: TODAY },
  ],
  'costa-rica': [
    { url: 'https://monteverdetravel.com/quetzal-season-in-monteverde/', label: 'Monteverde Travel', note: 'Confirms real breeding/display season runs Feb-Jun, peaking Mar-Apr, not Jan-Mar as previously scored', addedAt: TODAY },
  ],
  galapagos: [
    { url: 'https://galapagosinsiders.com/travel-blog/galapagos-birding-by-month-breeding-season/', label: 'Galapagos Insiders', note: 'Confirms garua-season seabird activity extends into Oct/Nov rather than cutting to zero after September', addedAt: TODAY },
  ],
  'colombian-andes': [
    { url: 'https://partnersinflight.org/wintering-distribution-of-declining-neotropical-migrants-in-colombian-andes/', label: 'Partners in Flight', addedAt: TODAY },
  ],
  ethiopia: [
    { url: 'https://www.safaribookings.com/ethiopia/birds', label: 'SafariBookings', note: 'Confirms November as a standout month (post-rain landscape, arrived migrants, lighter crowds), previously underweighted relative to Jan/Feb/Dec', addedAt: TODAY },
  ],
  greenland: [
    { url: 'https://npolar.no/en/species/little-auk/', label: 'Norsk Polarinstitutt', note: 'Confirms little auks arrive at colonies in May, not just June', addedAt: TODAY },
  ],
  peru: [
    { url: 'https://www.birdingecotours.com/when-is-the-best-time-to-visit-peru-colombia/', label: 'Birding Ecotours', note: 'Confirms dry-season access window extends through October', addedAt: TODAY },
  ],
  provence: [
    { url: 'https://threemonkeysonline.com/flamingo-spotting-in-the-camargue/', label: 'Three Monkeys Online', note: 'Confirms Camargue flamingo breeding peaks March-April, not June-July as previously scored', addedAt: TODAY },
  ],
  rio: [
    { url: 'https://www.10000birds.com/lowland-atlantic-forest-of-rio-de-janeiro-state-silva-jardim-casimiro-de-abreu-macae-brazil-profile-for-birders.htm', label: '10,000 Birds', note: 'Confirms austral spring (Sep-Nov) as the real breeding peak — the old event had this backwards, underweighting Sep-Nov and overweighting Jan/Dec', addedAt: TODAY },
  ],
  srilanka: [
    { url: 'https://safariinsrilanka.com/migratory-birds-wintering-in-sri-lanka/', label: 'Safari in Sri Lanka', addedAt: TODAY },
  ],
  tanzania: [
    { url: 'https://serengetiafricantours.com/seasonal-birding-when-where-to-see-migratory-birds-in-tanzania/', label: 'Serengeti African Tours', note: 'Confirms late November as probably the best overall month for migrants, previously scored as the weakest month of the whole event', addedAt: TODAY },
  ],
  uganda: [
    { url: 'https://birduganda.com/albertine-rift-endemic-birds/', label: 'Bird Uganda', note: 'Confirms Jun-Aug is the stronger dry season tied to endemic breeding — same tier-inversion bug already fixed on Rwanda’s identical event this session', addedAt: TODAY },
  ],
  kenya: [
    { url: 'https://kambucampers.com/palearctic-migrant-birds-in-kenya/', label: 'Kambu Campers', note: '"November is Kenya’s birding pinnacle" per source — previously scored as the weakest month', addedAt: TODAY },
  ],
  kruger: [
    { url: 'https://birding.krugerpark.co.za/birding-in-kruger-summer-visitors.html', label: 'Kruger Park Birding', note: 'Kruger-specific sources give a materially different shape from the copy-pasted Kenya/Tanzania version — real window is Oct-Apr, not Jan-Mar/Nov-Dec', addedAt: TODAY },
  ],
  hokkaido: [
    { url: 'https://hiromarusasazaki.wordpress.com/2025/12/01/red-crowned-crane-tancho-guide-hokkaido/', label: 'Hiro & Noki Adventure Tours', addedAt: TODAY },
  ],
  hongkong: [
    { url: 'https://www.birdinghongkong.com/the-birding-year.html', label: 'Birding Hong Kong', note: 'Confirms winter waterbird counts peak Dec-Jan, previously scored below November', addedAt: TODAY },
  ],
  madagascar: [
    { url: 'https://jenmansafaris.com/birding-season-in-madagascar/', label: 'Jenman Safaris', note: 'Confirms the optimal window extends into early December, combining dry-season access with peak vocal activity', addedAt: TODAY },
  ],
  morocco: [
    { url: 'https://deepinmorocco.com/places/souss-massa-national-park/', label: 'Deep in Morocco', addedAt: TODAY },
  ],
  'cape-cod-islands': [
    { url: 'https://bird-spot.com/blog/fall-migration-guide-2026', label: 'BirdSpot', note: 'Confirms a real, well-documented fall migration/seawatch phenomenon with zero event previously scored', addedAt: TODAY },
  ],
  egypt: [
    { url: 'https://tethys.pnnl.gov/publications/autumn-migration-soaring-birds-through-gebel-el-zeit-important-bird-area-iba-egypt', label: 'Tethys / PNNL', note: 'Gebel El Zeit is a globally significant raptor bottleneck (~1.5M birds) with zero event previously scored', addedAt: TODAY },
  ],
  guatemala: [
    { url: 'https://www.cayaya-birding.com/Biotopo.htm', label: 'Cayaya Birding', note: 'Biotopo del Quetzal is a real, dedicated quetzal-breeding-display reserve comparable to Costa Rica’s, with zero event previously scored', addedAt: TODAY },
  ],
  churchill: [
    { url: 'https://www.eagle-eye.com/tour/churchill-southern-manitoba-birding-tour/', label: 'Eagle-Eye Tours', note: 'A sharply seasonal Jun-Jul window already described accurately in the destination’s own overview/monthly text, with zero event backing it', addedAt: TODAY },
  ],
  edinburgh: [
    { url: 'https://www.seabird.org/seasonal-wildlife', label: 'Scottish Seabird Centre', note: 'Bass Rock hosts the world’s largest northern gannet colony, a short trip from the city, with zero event previously scored', addedAt: TODAY },
  ],
  'cape-town': [
    { url: 'https://capetownpelagics.com/', label: 'Cape Town Pelagics', note: 'Confirms world-class winter (May-Sep) pelagic albatross diversity; the destination’s own text already described the spring protea/fynbos peak with zero event behind either', addedAt: TODAY },
  ],
  'rajasthan-golden-triangle': [
    { url: 'https://en.wikipedia.org/wiki/Keoladeo_National_Park', label: 'Wikipedia — Keoladeo National Park', note: 'One of the world’s most famous bird sanctuaries, already described accurately in the destination’s own text, with zero event backing it', addedAt: TODAY },
  ],
  'scottish-highlands-skye': [
    { url: 'https://heatherlea.co.uk/tour/highlands-and-corncrake/', label: 'Heatherlea', addedAt: TODAY },
  ],
  'tbilisi-caucasus': [
    { url: 'https://www.batumiraptorcount.org/history-of-research', label: 'Batumi Raptor Count', note: 'Over 1 million raptors funnel through the Batumi Bottleneck each autumn — the destination’s own overview previously denied any migration spectacle existed in the region', addedAt: TODAY },
  ],
  taiwan: [
    { url: 'https://www.taiwannews.com.tw/news/6215181', label: 'Taiwan News', note: 'Kenting’s Grey-faced Buzzard migration is one of the top raptor migration sites globally, with zero event previously scored', addedAt: TODAY },
  ],
  seychelles: [
    { url: 'https://www.birdislandseychelles.com/flora-and-fauna/birds/the-sooty-tern-colony/', label: 'Bird Island Seychelles', note: 'Confirms a highly synchronized colony of 1-1.5 million sooty terns, breeding June, with 90% of eggs laid within 10 days', addedAt: TODAY },
  ],
  iceland: [
    { url: 'https://adventures.is/blog/puffins-in-iceland/', label: 'Arctic Adventures', note: 'Confirms Iceland’s two largest seabird colonies (Látrabjarg, Westman Islands, ~800,000 pairs) peak Jun-Jul, already described in the destination’s own text with zero event behind it', addedAt: TODAY },
  ],
  lapland: [
    { url: 'https://www.birdguides.com/articles/features/lapland-birds-of-the-midnight-sun/', label: 'BirdGuides', note: 'Confirms a real late-spring peak (Arctic owl courtship, breeding wader arrival) that directly contradicted the destination’s own text, which claimed no seasonal spectacle existed', addedAt: TODAY },
  ],
  nepal: [
    { url: 'https://kathmandupost.com/national/2016/10/23/migratory-birds-start-arriving-in-koshi-tappu', label: 'Kathmandu Post', note: 'Confirms Koshi Tappu’s winter migrant window (Oct-Mar), distinct from the destination’s existing mountain-trekking-season framing', addedAt: TODAY },
  ],
  kerala: [
    { url: 'https://www.indiabirdingtours.com/birding-kerala.html', label: 'India Birding Tours', note: 'Confirms a clear Nov-Mar winter-migrant window consistent with the destination’s existing dry-season-access framing, with zero event previously behind it', addedAt: TODAY },
  ],
  'monterey-big-sur': [
    { url: 'https://goldengatebirdalliance.org/blog-posts/pelagic-birding-for-beginners-4-6/', label: 'Golden Gate Bird Alliance', note: 'Confirms Aug-Oct as peak pelagic season — the destination’s own text already made this exact claim year-round with zero event behind it', addedAt: TODAY },
  ],
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
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
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, sources] of Object.entries(SOURCES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const existing = ((row.sliderSources as Record<string, Source[]>) ?? {})[KEY] ?? [];
    const patch = { sliderSources: { ...(row.sliderSources as Record<string, unknown>), [KEY]: [...existing, ...sources] } };
    console.log(`${id}: ${sources.length} source(s)`);
    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run' : '\ndone');
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
