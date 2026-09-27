import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// wildlifeViewing content-completeness pass, prompted directly by user
// pushback on this session's rule (docs/interest-content-authoring-
// playbook.md §2, "A species belongs in wildlifeViewing if it's a
// headline, general-audience draw"): a scan comparing every
// destination's `birding` overview against its `wildlifeViewing`
// content found 32 places where birding names a charismatic, general-
// audience bird (flamingo, toucan, macaw, quetzal, condor, puffin,
// kiwi) that wildlifeViewing never mentions at all. Fixed the ~18
// clearest, highest-confidence cases here — skipped the marginal ones
// (common bald eagles without a real attached spectacle; destinations
// already rich enough that one more species wouldn't register) to
// avoid overcorrecting into bird-heavy wildlifeViewing content, per
// the user's explicit caution.
//
// costa-rica is the flagship case: its birding overview already had a
// full quetzal (Dec-Apr) + Great Green Macaw (Feb-Aug, Boca Tapada)
// treatment, entirely absent from wildlifeViewing's sloths-and-monkeys
// story. Given this destination's caliber is genuinely richer than
// what informed this session's earlier over-claim taper (10->8.5),
// its scores are nudged back up modestly (8.8-9.2) to reflect the
// fuller picture, without returning to the literal-10 plateau that
// taper was correcting for.
//
// Faroe Islands and Lofoten needed no score change at all — their
// existing "seabird cliffs are active" text and score already
// credited the puffin colonies, just without naming the species.
const KEY = 'wildlifeViewing';

interface Fix {
  overview?: string;
  scores: Partial<Record<number, number>>;
  text?: Partial<Record<number, string>>;
}

const FIXES: Record<string, Fix> = {
  'costa-rica': {
    overview: 'Sloths are the animal most visitors have their heart set on here, and they’re genuinely easy to find in the right reserves — a slow-moving, near-guaranteed sighting. Howler, capuchin, and squirrel monkeys are common too. Resplendent quetzals display in the cloud forest canopy (peak December-April), and scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
    scores: { 0: 9.2, 1: 9.2, 2: 9.2, 3: 9.2, 4: 8.8, 5: 8.8, 6: 8.8, 7: 8.8, 8: 8.5, 9: 8.5, 10: 8.8, 11: 9.2 },
    text: {
      0: 'Sloths remain a near-guaranteed sighting in the right reserves, and resplendent quetzals are displaying in the cloud forest canopy — one of the best times of year to see one. Scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      1: 'Sloths remain a near-guaranteed sighting in the right reserves, and resplendent quetzals are displaying in the cloud forest canopy — one of the best times of year to see one. Scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      2: 'Sloths remain a near-guaranteed sighting in the right reserves, and resplendent quetzals are displaying in the cloud forest canopy — one of the best times of year to see one. Scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      3: 'Sloths remain a near-guaranteed sighting in the right reserves, and resplendent quetzals are displaying in the cloud forest canopy — one of the best times of year to see one. Scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      4: 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too, and scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      5: 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too, and scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      6: 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too, and scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      7: 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too, and scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      8: 'Heavier rains ease sightings slightly, though sloths, monkeys, and the Osa Peninsula’s scarlet macaws all remain reliable.',
      9: 'Heavier rains ease sightings slightly, though sloths, monkeys, and the Osa Peninsula’s scarlet macaws all remain reliable.',
      10: 'Sloths remain a near-guaranteed sighting in the right reserves; howler, capuchin, and squirrel monkeys are common too, and scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
      11: 'Sloths remain a near-guaranteed sighting in the right reserves, and resplendent quetzals are displaying in the cloud forest canopy — one of the best times of year to see one. Scarlet macaws are a reliable year-round sighting on the Osa Peninsula.',
    },
  },
  belize: {
    overview: 'Cockscomb Basin, the world’s first jaguar reserve, protects a real population — though actually seeing one remains rare, even here. Howler monkeys, manatees, and keel-billed toucans (the national bird) are far more reliable sightings, and scarlet macaws breed at Red Bank.',
    scores: { 0: 7.8, 1: 7.8, 2: 7.8, 3: 7.8, 4: 7.8, 5: 7.8, 6: 7.8, 7: 7.8, 8: 7.8, 9: 7.8, 10: 7.8, 11: 7.8 },
    text: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i,
      'Cockscomb Basin, the world’s first jaguar reserve, protects a real population — though actually seeing one remains rare, even here. Howler monkeys, manatees, and keel-billed toucans (the national bird) are far more reliable sightings, and scarlet macaws breed at Red Bank.'])),
  },
  guatemala: {
    overview: 'Howler and spider monkeys are a real, common sight around Tikal’s ruins, along with coatimundis foraging near the trails. Biotopo del Quetzal, a dedicated cloud-forest reserve, is a real quetzal-breeding-display destination each spring, on par with Costa Rica’s better-known version.',
    scores: { 2: 6.5, 3: 6.5, 4: 6.5 },
    text: {
      2: 'Howler and spider monkeys are a real, common sight around Tikal’s ruins, and this is peak quetzal breeding-display season at Biotopo del Quetzal — a dedicated reserve on par with Costa Rica’s better-known version.',
      3: 'Howler and spider monkeys are a real, common sight around Tikal’s ruins, and this is peak quetzal breeding-display season at Biotopo del Quetzal — a dedicated reserve on par with Costa Rica’s better-known version.',
      4: 'Howler and spider monkeys are a real, common sight around Tikal’s ruins, and this is peak quetzal breeding-display season at Biotopo del Quetzal — a dedicated reserve on par with Costa Rica’s better-known version.',
    },
  },
  chiapas: {
    overview: 'El Triunfo Biosphere Reserve holds a real quetzal population, best visited in the dry season when trails are passable; beyond that, wildlife-watching isn’t a dedicated focus here.',
    scores: { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 9: 5, 10: 5, 11: 5 },
    text: Object.fromEntries([0, 1, 2, 3, 4, 9, 10, 11].map((i) => [i,
      'El Triunfo Biosphere Reserve holds a real quetzal population, accessible now in the dry season; beyond that, wildlife-watching isn’t a dedicated focus here.'])),
  },
  rivieramaya: {
    overview: 'Whale sharks gather off Isla Holbox each summer, one of the largest reliable aggregations anywhere — a genuine, if seasonal, spectacle. Inland jungle areas hold toucans and motmots as a real, year-round bonus.',
    scores: { 0: 4.5, 1: 4.5, 2: 4.5, 3: 4.5, 4: 4.5, 9: 4.5, 10: 4.5, 11: 4.5 },
    text: Object.fromEntries([0, 1, 2, 3, 4, 9, 10, 11].map((i) => [i,
      'Whale sharks haven’t yet arrived off Isla Holbox, though inland jungle areas hold toucans and motmots as a year-round bonus.'])),
  },
  uyuni: {
    overview: 'Vicuña, a wild, undomesticated relative of the llama, are a real, fairly common sighting on the high Altiplano surrounding the salt flat. High-altitude lagoons nearby hold three flamingo species — Andean, Chilean, and James’s — best reached during the dry season.',
    scores: { 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6 },
    text: Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10].map((i) => [i,
      'Vicuña remain a real, fairly common sighting on the high Altiplano, and the salt flat’s high-altitude lagoons hold three flamingo species — Andean, Chilean, and James’s.'])),
  },
  atacama: {
    overview: 'Vicuña, a wild, undomesticated relative of the llama, are a real, fairly common sighting on the high Altiplano. High-altitude lagoons nearby hold three flamingo species — Andean, Chilean, and the rare James’s flamingo.',
    scores: { 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6 },
    text: Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => [i,
      'Vicuña remain a real, fairly common sighting on the high Altiplano, alongside high-altitude lagoons holding three flamingo species — Andean, Chilean, and the rare James’s flamingo.'])),
  },
  provence: {
    overview: 'The Camargue wetlands hold one of Europe’s great greater-flamingo breeding strongholds, alongside large heron and egret colonies; beyond that, wildlife-watching isn’t a dedicated focus here.',
    scores: { 0: 3.5, 1: 3.5, 2: 3.5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 3.5, 9: 3.5, 10: 3.5, 11: 3.5 },
    text: {
      0: 'Flamingos remain present in the Camargue wetlands year-round, though the breeding spectacle has eased; beyond that, wildlife-watching isn’t a dedicated focus here.',
      1: 'Flamingos remain present in the Camargue wetlands year-round, though the breeding spectacle has eased; beyond that, wildlife-watching isn’t a dedicated focus here.',
      2: 'Flamingos remain present in the Camargue wetlands year-round, though the breeding spectacle has eased; beyond that, wildlife-watching isn’t a dedicated focus here.',
      3: 'The Camargue wetlands are alive with breeding greater flamingos, herons, and egrets this time of year.',
      4: 'The Camargue wetlands are alive with breeding greater flamingos, herons, and egrets this time of year.',
      5: 'The Camargue wetlands are alive with breeding greater flamingos, herons, and egrets this time of year.',
      6: 'The Camargue wetlands are alive with breeding greater flamingos, herons, and egrets this time of year.',
      7: 'The Camargue wetlands are alive with breeding greater flamingos, herons, and egrets this time of year.',
      8: 'Flamingos remain present in the Camargue wetlands year-round, though the breeding spectacle has eased; beyond that, wildlife-watching isn’t a dedicated focus here.',
      9: 'Flamingos remain present in the Camargue wetlands year-round, though the breeding spectacle has eased; beyond that, wildlife-watching isn’t a dedicated focus here.',
      10: 'Flamingos remain present in the Camargue wetlands year-round, though the breeding spectacle has eased; beyond that, wildlife-watching isn’t a dedicated focus here.',
      11: 'Flamingos remain present in the Camargue wetlands year-round, though the breeding spectacle has eased; beyond that, wildlife-watching isn’t a dedicated focus here.',
    },
  },
  'turks-caicos': {
    overview: 'West Indian flamingos breed on the remote southern islands — a real, if out-of-the-way, sighting; beyond that, wildlife-watching isn’t a dedicated focus here beyond common reef life.',
    scores: {},
  },
  bahamas: {
    overview: 'West Indian flamingos breed in large numbers on the remote southern islands (Inagua) — a real, if far from the main tourist areas, sighting; beyond that, wildlife-watching isn’t a dedicated focus here beyond common reef life.',
    scores: {},
  },
  'north-island': {
    overview: 'Kiwi are present but genuinely rare and nocturnal — a dedicated night tour is the realistic way to try. Beyond that, wildlife-watching isn’t a dedicated focus here.',
    scores: { 0: 4, 1: 4, 2: 4, 3: 4, 4: 4, 5: 3, 6: 3, 7: 3, 8: 4, 9: 4, 10: 4, 11: 4 },
    text: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i,
      'Wildlife-watching isn’t a dedicated focus here, though a dedicated night tour for New Zealand’s iconic (and genuinely elusive) kiwi is a real, bookable activity.'])),
  },
  iceland: {
    overview: 'Iceland’s only native land mammal, the Arctic fox, is a real but genuinely elusive sighting — the Westfjords’ Hornstrandir Nature Reserve is the best-known spot. Puffin colonies line the sea cliffs each summer (roughly May-August) — a far easier, more reliable sighting.',
    scores: { 4: 8, 5: 8, 6: 8, 7: 8 },
    text: Object.fromEntries([4, 5, 6, 7].map((i) => [i,
      'Puffin colonies are active on the sea cliffs — a far easier, more reliable sighting than Iceland’s elusive Arctic fox, which remains a matter of luck even now.'])),
  },
  'el-chalten': {
    overview: 'Guanaco are a common sight on the trails around Fitz Roy, and Andean condors are a real, fairly reliable sighting soaring overhead. Puma are present but sightings are a matter of luck, not a guided pursuit.',
    scores: { 0: 6, 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6 },
    text: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i,
      'Guanaco are a common sight on the trails around Fitz Roy, and Andean condors are a real, fairly reliable sighting soaring overhead. Puma are present but sightings are a matter of luck, not a guided pursuit.'])),
  },
  'zion-bryce': {
    overview: 'Bighorn sheep on Zion’s cliffs are elusive — best odds near the east entrance road at dawn. Bryce protects a real, threatened Utah prairie dog colony, visible at its burrows. California condors, reintroduced to the region, are a real sighting near the higher viewpoints, most visible during their spring courtship display.',
    scores: { 0: 5, 1: 5, 2: 5.5, 3: 5.5, 4: 5.5, 5: 5, 6: 4, 7: 5, 8: 6.5, 9: 5.5, 10: 5, 11: 5 },
    text: {
      0: 'Bryce’s prairie dogs are hibernating and not visible. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
      1: 'Bryce’s prairie dogs are hibernating and not visible. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
      2: 'Bryce’s prairie dogs are hibernating and not visible. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, but California condors are most visible near the region’s nesting cliffs during their spring courtship display.',
      3: 'Bryce’s prairie dogs are active at their burrows. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, but California condors are most visible near the region’s nesting cliffs during their spring courtship display.',
      4: 'Bryce’s prairie dogs are active at their burrows. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, but California condors are most visible near the region’s nesting cliffs during their spring courtship display.',
      5: 'Bryce’s prairie dogs are active at their burrows. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
      6: 'Bryce’s prairie dogs are active at their burrows. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
      7: 'Bighorn sheep are more active and visible on Zion’s cliffs during the fall rut. Bryce’s prairie dogs remain active at their burrows, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
      8: 'Bighorn sheep are more active and visible on Zion’s cliffs during the fall rut. Bryce’s prairie dogs remain active at their burrows, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
      9: 'Bighorn sheep are more active and visible on Zion’s cliffs during the fall rut. Bryce’s prairie dogs remain active at their burrows, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
      10: 'Bryce’s prairie dogs are entering hibernation. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
      11: 'Bryce’s prairie dogs are hibernating and not visible. Bighorn sheep sightings on Zion’s cliffs remain a matter of luck, and California condors are a real, if less concentrated, sighting near the higher viewpoints.',
    },
  },
  grandcanyon: {
    overview: 'Wildlife-watching isn’t a dedicated draw here — mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails. California condors, reintroduced to the wild in the 1990s, are a real and often-thrilling sighting near the rim, most visible during their spring courtship season near nesting cliffs.',
    scores: { 0: 4.8, 1: 4.8, 2: 5.5, 3: 5.5, 4: 5.5, 5: 4.8, 6: 4.8, 7: 4.8, 8: 4.8, 9: 4.8, 10: 4.8, 11: 4.8 },
    text: {
      0: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
      1: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
      2: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails, and this is California condor courtship season — the most reliable stretch to spot one near the nesting cliffs.',
      3: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails, and this is California condor courtship season — the most reliable stretch to spot one near the nesting cliffs.',
      4: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails, and this is California condor courtship season — the most reliable stretch to spot one near the nesting cliffs.',
      5: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
      6: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
      7: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
      8: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
      9: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
      10: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
      11: 'Mule deer and bighorn sheep are the common sightings along the rim and inner canyon trails; California condors are a real, if less concentrated, sighting near the rim.',
    },
  },
  'ecuadorian-andes': {
    overview: 'Mountain tapir, a rare high-Andean specialist, and spectacled bear are both present in the cloud forest and high altitude paramo grassland, though sightings of either take real luck and odds are best with a dedicated guide. The mid-elevation cloud forests are famed for incredible diversity of birdlife including spectacular varieties of colorful toucans and hummingbirds, and Andean condors soar over the high-altitude páramo grassland — a real, dramatic sighting.',
    scores: {},
  },
  'faroe-islands': {
    overview: 'Seabird cliffs are the main wildlife draw here each summer, including dense Atlantic puffin colonies; beyond that, wildlife-watching isn’t a dedicated focus.',
    scores: {},
    text: {
      4: 'Seabird cliffs are active with nesting colonies, including dense puffin colonies.',
      5: 'Seabird cliffs are active with nesting colonies, including dense puffin colonies.',
      6: 'Seabird cliffs are active with nesting colonies, including dense puffin colonies.',
      7: 'Seabird cliffs are active with nesting colonies, including dense puffin colonies.',
    },
  },
  lofoten: {
    overview: 'Orca once reliably followed the winter herring run close to shore here, but the herring have shifted north toward Tromsø and Skjervøy since around 2022, and sightings directly off Lofoten are no longer as dependable — most operators now run trips from those towns instead, several hours further north. Seabird cliffs remain active and reliable each summer, including puffins, guillemots, and kittiwakes.',
    scores: {},
    text: {
      4: 'Seabird cliffs are active with nesting colonies, including puffins, guillemots, and kittiwakes.',
      5: 'Seabird cliffs are active with nesting colonies, including puffins, guillemots, and kittiwakes.',
      6: 'Seabird cliffs are active with nesting colonies, including puffins, guillemots, and kittiwakes.',
      7: 'Seabird cliffs are active with nesting colonies, including puffins, guillemots, and kittiwakes.',
    },
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
