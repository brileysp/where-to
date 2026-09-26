import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Birding de-flattening pass, part 2 (docs/interest-content-authoring-
// playbook.md §2): the true-10-rarity taper for four over-claiming
// birding meccas, plus a content-depth upgrade for the destinations
// where the existing copy named only "gateway" species (quetzal,
// toucan, macaw — genuinely exciting to a general traveler, but not
// what tells a working birder this destination's author knows the
// scene) rather than the specialist targets serious birders actually
// travel for, per direct user feedback this session.
//
//  - antarctica: NOT a mean-flatten candidate like the batch in
//    author-birding-flatten.ts. Its swing (5,2,2,0x7,5,5) under one
//    recycled sentence conflates a real hard constraint (no ships
//    sail Apr-Oct — the same fact already correctly captured in its
//    wildlifeViewing content) with an actual quality difference
//    (Jan/Nov/Dec peak vs Feb/Mar shoulder). Split into three honest
//    text groups instead of averaging them into a meaningless middle
//    number.
//  - madagascar, colombian-andes, papua-new-guinea, peruvian-amazon:
//    each had a real, well-differentiated seasonal curve already (wet-
//    season access limits, dry-season/low-water peaks) but still let
//    4-5 months sit at literal 10.0 — tapered to 9.5, consistent with
//    the true-10-rarity standard applied everywhere else this session.
//  - costa-rica, ecuadorian-andes, colombian-andes, peruvian-amazon,
//    papua-new-guinea: content upgraded with genuine specialist
//    targets (antpitta feeding stations, mountain-toucans, Andean
//    cock-of-the-rock leks, antbird-led mixed-species flocks, named
//    birds-of-paradise) instead of only the general-audience species
//    already covered by wildlifeViewing.
//  - uganda: added a mention of the shoebill, Africa's single most
//    sought-after bird for visiting birders and a glaring omission
//    from a birding overview that otherwise reads as knowledgeable.
const KEY = 'birding';

interface Fix {
  overview?: string;
  scores: Partial<Record<number, number>>;
  text?: Partial<Record<number, string>>;
}

const FIXES: Record<string, Fix> = {
  antarctica: {
    scores: {},
    text: {
      1: 'The season is winding down — chicks are fledging and colonies are thinning, though seabirds remain a real, visually enormous presence.',
      2: 'The season is winding down — chicks are fledging and colonies are thinning, though seabirds remain a real, visually enormous presence.',
      3: 'Antarctica is inaccessible for birding — no ships sail this route.',
      4: 'Antarctica is inaccessible for birding — no ships sail this route.',
      5: 'Antarctica is inaccessible for birding — no ships sail this route.',
      6: 'Antarctica is inaccessible for birding — no ships sail this route.',
      7: 'Antarctica is inaccessible for birding — no ships sail this route.',
      8: 'Antarctica is inaccessible for birding — no ships sail this route.',
      9: 'Antarctica is inaccessible for birding — no ships sail this route.',
    },
  },
  madagascar: { scores: { 5: 9.5, 6: 9.5, 7: 9.5, 8: 9.5 } },
  'papua-new-guinea': {
    scores: { 5: 9.5, 6: 9.5, 7: 9.5, 8: 9.5 },
    text: Object.fromEntries([5, 6, 7, 8].map((i) => [i,
      'Dry-season conditions give the best access to highland forest sites, where birds-of-paradise display sites are concentrated — Raggiana, Ribbon-tailed Astrapia, and King of Saxony are among the most sought-after.'])),
  },
  'peruvian-amazon': {
    overview: 'Lowland rainforest and riverbank habitat hold some of the highest single-site species counts on Earth. Macaws and parrots gather at clay licks along the riverbanks, feeding on mineral-rich clay exposed as water levels drop. Antbird-led mixed-species understory flocks are a genuine specialist draw, and a lucky harpy eagle sighting is the ultimate prize.',
    scores: { 5: 9.5, 6: 9.5, 7: 9.5, 8: 9.5 },
    text: {
      0: 'High water levels submerge the riverbank clay licks and limit trail access into the forest interior, though canopy-tower birding for antbird-led mixed-species flocks remains productive.',
      1: 'High water levels submerge the riverbank clay licks and limit trail access into the forest interior, though canopy-tower birding for antbird-led mixed-species flocks remains productive.',
      2: 'High water levels submerge the riverbank clay licks and limit trail access into the forest interior, though canopy-tower birding for antbird-led mixed-species flocks remains productive.',
      5: 'Low-water season exposes the riverbank clay licks where macaws and parrots gather, and eases trail access to the antbird-led mixed-species flocks in the forest interior.',
      6: 'Low-water season exposes the riverbank clay licks where macaws and parrots gather, and eases trail access to the antbird-led mixed-species flocks in the forest interior.',
      7: 'Low-water season exposes the riverbank clay licks where macaws and parrots gather, and eases trail access to the antbird-led mixed-species flocks in the forest interior.',
      8: 'Low-water season exposes the riverbank clay licks where macaws and parrots gather, and eases trail access to the antbird-led mixed-species flocks in the forest interior.',
    },
  },
  'colombian-andes': {
    overview: 'More recorded bird species than any other country on Earth — around 1,900 — concentrated in cloud forest and páramo habitats across three Andean mountain ranges. Hummingbird diversity here is exceptional, with dozens of species sometimes visible at a single feeder station. Antpitta feeding stations near Manizales and Río Blanco give close, reliable looks at normally skulking species, mountain-toucans are a real cloud-forest highlight, and dawn leks of the Andean cock-of-the-rock are a genuine specialist draw.',
    scores: { 10: 9.5, 11: 9.5, 0: 9.5, 1: 9.5, 2: 9.5 },
    text: {
      10: 'North American migratory species overwinter alongside residents like antpittas, mountain-toucans, and Andean cock-of-the-rock, adding to an already exceptional diversity.',
      11: 'North American migratory species overwinter alongside residents like antpittas, mountain-toucans, and Andean cock-of-the-rock, adding to an already exceptional diversity.',
      0: 'North American migratory species overwinter alongside residents like antpittas, mountain-toucans, and Andean cock-of-the-rock, adding to an already exceptional diversity.',
      1: 'North American migratory species overwinter alongside residents like antpittas, mountain-toucans, and Andean cock-of-the-rock, adding to an already exceptional diversity.',
      2: 'North American migratory species overwinter alongside residents like antpittas, mountain-toucans, and Andean cock-of-the-rock, adding to an already exceptional diversity.',
      3: 'Migrants have departed, but resident specialties carry the baseline — antpitta feeding stations near Manizales and Río Blanco, mountain-toucans in the high cloud forest, and dawn leks of the Andean cock-of-the-rock.',
      4: 'Migrants have departed, but resident specialties carry the baseline — antpitta feeding stations near Manizales and Río Blanco, mountain-toucans in the high cloud forest, and dawn leks of the Andean cock-of-the-rock.',
      5: 'Dry-season conditions ease trail access into cloud forest sites, including the antpitta feeding stations near Manizales and Río Blanco.',
      6: 'Dry-season conditions ease trail access into cloud forest sites, including the antpitta feeding stations near Manizales and Río Blanco.',
      7: 'Dry-season conditions ease trail access into cloud forest sites, including the antpitta feeding stations near Manizales and Río Blanco.',
      8: 'Migrants have not yet arrived, but resident specialties carry the baseline — antpitta feeding stations, mountain-toucans, and Andean cock-of-the-rock leks all remain a real draw.',
    },
  },
  'costa-rica': {
    overview: 'Roughly 900 recorded species packed into a small area — Pacific and Caribbean slopes plus a full elevation gradient from lowland rainforest to cloud forest. Resplendent quetzals display in the cloud forest canopy from December through April; despite the rain, August through November is a genuinely exceptional migration season, and Boca Tapada’s Great Green Macaws breed from February through August. Three-wattled bellbirds (an unmistakable, far-carrying call) and the tiny snowcap hummingbird are real Caribbean-slope specialties, and antbird-led mixed-species flocks reward patient birders throughout.',
    scores: {},
    text: {
      4: 'Quetzal display season is winding down but still active; general lowland and coastal birding continues at a strong baseline, with Great Green Macaws still breeding at Boca Tapada and three-wattled bellbirds vocal on the Caribbean slope.',
      5: 'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline, with Great Green Macaws still breeding at Boca Tapada and antbird-led mixed-species flocks a reliable highlight in the lowland forest.',
      6: 'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline, with Great Green Macaws still breeding at Boca Tapada and antbird-led mixed-species flocks a reliable highlight in the lowland forest.',
    },
  },
  'ecuadorian-andes': {
    overview: 'Over 130 hummingbird species recorded in Ecuador alone, alongside Andean condors soaring over páramo grassland. The elevational range from high páramo down through cloud forest concentrates an exceptional diversity into a small area. Dry-season months make trails easier, but many species are actually most active — displaying and breeding — during the wetter months, so a quieter trail isn’t necessarily a quieter bird. Antpitta feeding stations (Refugio Paz de las Aves is the classic example) give close looks at normally unseeable birds, and mountain-toucans are a real cloud-forest highlight alongside dawn leks of the Andean cock-of-the-rock.',
    scores: {},
    text: {
      1: 'Wetter conditions make higher-elevation trails harder going, though cloud-forest specialties — antpittas at their feeding stations, mountain-toucans, cock-of-the-rock — stay just as active regardless of trail conditions.',
      2: 'Wetter conditions make higher-elevation trails harder going, though cloud-forest specialties — antpittas at their feeding stations, mountain-toucans, cock-of-the-rock — stay just as active regardless of trail conditions.',
      3: 'Wetter conditions make higher-elevation trails harder going, though cloud-forest specialties — antpittas at their feeding stations, mountain-toucans, cock-of-the-rock — stay just as active regardless of trail conditions.',
      5: 'The main dry season eases access across the full elevational range, from páramo down through cloud forest — including the antpitta feeding stations and Andean cock-of-the-rock leks that are the region’s signature specialties.',
      6: 'The main dry season eases access across the full elevational range, from páramo down through cloud forest — including the antpitta feeding stations and Andean cock-of-the-rock leks that are the region’s signature specialties.',
      7: 'The main dry season eases access across the full elevational range, from páramo down through cloud forest — including the antpitta feeding stations and Andean cock-of-the-rock leks that are the region’s signature specialties.',
      10: 'Wetter conditions make higher-elevation trails harder going, though cloud-forest specialties — antpittas at their feeding stations, mountain-toucans, cock-of-the-rock — stay just as active regardless of trail conditions.',
    },
  },
  uganda: {
    overview: 'Forest, savanna, and wetland habitats combine to hold the Albertine Rift’s endemic-rich birdlife — species found almost nowhere else on Earth. Bwindi and Rwenzori forest interiors hold the deepest concentration. The June-August dry season is genuinely the stronger of the region’s two dry spells, tied to the endemics’ own breeding season; the shorter December-February dry season is real but secondary. The shoebill — Africa’s single most sought-after bird for visiting birders — is a real, if unpredictable, sighting in the papyrus swamps at Mabamba Bay.',
    scores: {},
  },
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const ids = Object.keys(FIXES);
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const scored = scorePlace(row);
    const live = scored.monthly[KEY];
    const fix = FIXES[id];

    const finalOverride: Record<number, number> = { ...(scoreOverridesBefore[KEY] || {}) };
    let changedCount = 0;
    for (const [idxStr, val] of Object.entries(fix.scores)) {
      const idx = Number(idxStr);
      if (val === undefined) continue;
      if (live[idx] !== val) changedCount++;
      finalOverride[idx] = val;
    }

    const patch: Record<string, unknown> = {
      scoreOverrides: { ...scoreOverridesBefore, [KEY]: finalOverride },
    };
    const textEntries = Object.entries(fix.text ?? {}).filter(([, v]) => v !== undefined);
    if (textEntries.length > 0) {
      const mw = [...((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] || new Array(12).fill(null))];
      for (const [idxStr, text] of textEntries) mw[Number(idxStr)] = text as string;
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: mw };
    }
    if (fix.overview) {
      patch.sliderOverview = { ...(row.sliderOverview as Record<string, string>), [KEY]: fix.overview };
    }

    console.log(`\n${row.name} (${id}) — ${changedCount} scores changed, ${textEntries.length} text updated, overview ${fix.overview ? 'updated' : 'unchanged'}`);
    for (const [idxStr, val] of Object.entries(fix.scores)) {
      const idx = Number(idxStr);
      if (val !== undefined && live[idx] !== val) {
        console.log(`  ${MONTH_NAMES[idx].padEnd(10)} ${live[idx]} -> ${val}`);
      }
    }

    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
  }

  console.log(dryRun ? '\n\ndry run — nothing written.' : '\n\ndone — written to scoreOverrides / sliderMonthlyWeather / sliderOverview.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
