import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

type Event = { label: string; weight: number; months: Record<number, number> };

// Cross-checked against Cascada Expediciones/Swoop Patagonia/Wildlife
// Diaries (puma), Yellowstone Safari Co/Teton Science Schools/Nomad
// Yellowstone (wolves), WATE/RomanticAsheville/GreatSmokies.com (elk),
// Cape Cod Chamber/Rove.me (whales), guidetolofoten.com/ORCA UK/
// whalewatchingtromso.com (orca shift), koek.sc/MCSS (whale sharks),
// vianica.com/ResearchGate (La Flor arribada), Rainforest Expeditions
// (clay licks — checked, not changed, see below), japan.travel/
// hiromarusasazaki (cranes), africageographic/masaimaramigration.com
// (river crossings), roughguides/elephantguide (Periyar), ju-lehadventure/
// tourmyindia/vargiskhan (Ladakh winter access & snow leopard season),
// mauiwhalewatching.com/hikemaui (Maui peak), etoshanationalpark.com.na
// (Etosha peak). Tambopata/Manu clay-lick claim from batch 3 was checked
// and NOT applied — broader consensus (Rainforest Expeditions, Tour The
// Tropics) favors the dry season (Aug-Oct) for raw numbers/reliability,
// contradicting the single-operator claim the audit agent surfaced.

const EVENTS: Record<string, Event[]> = {
  'torres-del-paine': [
    { label: 'Austral spring/summer season', weight: 1, months: { 1: 1, 2: 1, 3: 1, 10: 1, 11: 1, 12: 1 } },
    { label: 'Winter puma tracking season (guanaco concentration, snow-track visibility)', weight: 2, months: { 6: 0.7, 7: 1, 8: 1 } },
  ],
  yellowstone: [
    { label: 'Newborn wildlife (spring)', weight: 3, months: { 5: 1, 6: 0.5 } },
    { label: 'Elk rut (fall)', weight: 3, months: { 9: 1, 10: 0.5 } },
    { label: 'Wolf watching (winter pack visibility, Lamar Valley)', weight: 3, months: { 12: 0.5, 1: 0.8, 2: 1, 3: 1 } },
  ],
  'great-smoky-mountains': [
    { label: 'Synchronous firefly show', weight: 3, months: { 5: 0.6, 6: 1 } },
    { label: 'Elk rut (bugling season, Cataloochee Valley)', weight: 3, months: { 9: 1, 10: 0.7 } },
  ],
  'cape-cod-islands': [
    { label: 'Stellwagen Bank whale season overlap', weight: 7, months: { 4: 0.5, 5: 0.85, 6: 1, 7: 1, 8: 1, 9: 1, 10: 0.7 } },
  ],
  rwanda: [
    { label: 'Easier, drier trekking trails', weight: 1.5, months: { 1: 0.6, 2: 0.6, 6: 1, 7: 1, 8: 1, 9: 0.6, 12: 0.6 } },
  ],
  lofoten: [
    { label: 'Winter orca (herring run) — reduced reliability, activity shifted north', weight: 1.5, months: { 1: 1, 11: 0.6, 12: 1 } },
    { label: 'Summer bird cliffs', weight: 2.5, months: { 5: 0.6, 6: 1, 7: 1, 8: 0.7 } },
  ],
  komodo: [
    { label: 'Central Komodo manta ray activity (Karang Makassar)', weight: 1.5, months: { 7: 0.5, 8: 1, 9: 1, 10: 0.7 } },
    { label: 'Southern Komodo manta ray aggregation (Manta Alley)', weight: 2.5, months: { 12: 0.5, 1: 1, 2: 1, 3: 0.7 } },
  ],
  seychelles: [
    { label: 'Whale shark season (peak)', weight: 6, months: { 9: 0.4, 10: 1, 11: 1 } },
    { label: 'Aldabra giant tortoises (Curieuse Island, non-seasonal)', weight: 3, months: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 } },
  ],
  nicaragua: [
    { label: 'La Flor olive ridley turtle arribada', weight: 4, months: { 7: 0.4, 8: 0.6, 9: 1, 10: 1, 11: 0.7, 12: 0.4 } },
  ],
  'monterey-big-sur': [
    { label: 'Elephant seal pupping season (Año Nuevo)', weight: 5, months: { 12: 0.7, 1: 1, 2: 0.7 } },
    { label: 'Gray whale northbound migration', weight: 4, months: { 2: 0.4, 3: 1, 4: 1 } },
  ],
  maui: [
    { label: 'Humpback whale season overlap', weight: 5, months: { 12: 0.5, 1: 0.85, 2: 1, 3: 1, 4: 0.5 } },
  ],
  hokkaido: [
    { label: 'Red-crowned crane viewing (Kushiro)', weight: 3, months: { 12: 0.6, 1: 1, 2: 1, 3: 0.6 } },
    { label: 'Brown bear salmon season (Shiretoko)', weight: 2, months: { 9: 0.6, 10: 1 } },
  ],
  kenya: [
    { label: 'Great Migration river crossings', weight: 2, months: { 6: 0.5, 7: 0.65, 8: 1, 9: 1, 10: 0.7 } },
  ],
  kerala: [
    { label: 'Periyar reservoir dry-season concentration', weight: 2, months: { 12: 0.5, 1: 0.75, 2: 0.85, 3: 1, 4: 1 } },
  ],
  // Dec/Jan/Feb are zeroed for EVERY slider here by a destination-wide
  // `inaccessible` flag (confirmed via debug: "inaccessible this month →
  // 0"), independent of wildlifeClosed and out of scope for a
  // wildlifeViewing-only fix — see the spawn_task flag for a follow-up on
  // whether that flag is still accurate given real winter/flight-in
  // tourism (Chadar trek, winter snow-leopard treks). Only Nov (genuinely
  // accessible, previously un-scored) and the existing March peak are
  // touched here.
  ladakh: [
    { label: 'Snow leopard tracking season (Hemis NP)', weight: 3, months: { 11: 0.5, 3: 1 } },
  ],
  namibia: [
    { label: 'Dry-season concentration', weight: 3, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.85 } },
  ],
};

const OVERVIEWS: Record<string, string> = {
  'torres-del-paine': "Pumas are genuinely trackable nearly year-round with a dedicated guide, but winter (June through August) is when success rates are highest — snow makes paw prints easy to follow and pushes guanaco, the puma's main prey, down into the accessible lower valleys. Guanaco, condor, and Darwin's rhea are common across the steppe in every season.",
  yellowstone: "Bison are the near-guaranteed sighting — massive herds roam right along the roads in Lamar and Hayden valleys. Wolves are the animal most visitors have their heart set on, and Lamar Valley is the best place in the world to find one, though even here it takes a spotting scope and real patience — winter (December through March) is genuinely the best window, when snowpack concentrates elk at lower elevations and makes wolves easier to spot against the white backdrop. Grizzly and black bears are also present but a matter of luck.",
  'great-smoky-mountains': "Black bears are genuinely common here — one of the densest populations in the East — and Cades Cove is the most reliable place to spot one. Elk, reintroduced to Cataloochee Valley, are a real site-specific bonus, and the fall rut — bugling, sparring bulls, dawn/dusk viewing from the roadside — is one of the most dramatic wildlife spectacles in the East each September and October. The synchronous firefly display at Elkmont each early summer is a famous, one-of-a-kind spectacle, though a lottery-won permit is now required to see it.",
  'cape-cod-islands': "Whales are visible offshore mid-April through October, with July through September the true peak — sighting rates approach 98% at Stellwagen Bank during these months. Wildlife-watching beyond that isn't a dedicated focus here.",
  lofoten: "Orca once reliably followed the winter herring run close to shore here, but the herring have shifted north toward Tromsø and Skjervøy since around 2022, and sightings directly off Lofoten are no longer as dependable — most operators now run trips from those towns instead, several hours further north. Seabird cliffs remain active and reliable each summer.",
  komodo: "Komodo dragons are that rare wild megafauna sighting that's genuinely close to guaranteed — ranger-led walks on Komodo and Rinca islands find them reliably, year-round, regardless of season. Manta rays are the other big draw, and unlike the dragons, they're genuinely seasonal: the southern aggregation site (Manta Alley) peaks December through March, while Central Komodo's cleaning stations are busiest August through October.",
  seychelles: "Aldabra giant tortoises, some of the largest in the world, roam freely and reliably on Curieuse Island year-round. Whale sharks pass through each year, with the real peak in October and November, as the trade winds ease and plankton concentrations build around the islands — not a fading tail end, but the height of the season.",
  maui: "Humpback whales are visible offshore each winter, December through April, with February the peak — the highest whale density and most active surface behavior of the season, including breaching and competition pods. Wildlife-watching beyond that isn't a dedicated focus here.",
  hokkaido: "Shiretoko's brown bears are the real highlight — boat cruises along the coast in autumn get remarkably close as bears fish for salmon at the river mouths. Kushiro's red-crowned cranes, doing their elaborate courtship dance on the snow each winter (December through March), are a famous, only-in-Hokkaido sight of their own.",
  'monterey-big-sur': "Año Nuevo's elephant seal colony is a genuinely dramatic, reliable sighting during the winter breeding season — peak births are in January, with males fighting for territory and pups born on the beach. Gray whales pass by on their northbound migration back to Arctic feeding grounds each spring, most visible March and April, distinct from the seal season though the two do overlap in February.",
  ladakh: "Snow leopards are the reason people come to Hemis National Park, and even here — among the best odds anywhere for the species — sightings are genuinely rare and require a dedicated multi-day trip with expert trackers. The season effectively starts in November, as leopards begin descending with the cold to follow their prey, though it's March, right as the high valleys reopen, that's most widely cited as the true peak. Blue sheep, the snow leopard's main prey, are common and worth watching for their own sake. The high valleys are snowed shut from December through February.",
};

const MONTHLY: Record<string, string[]> = {
  'torres-del-paine': [
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.',
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.',
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.',
    'Fewer visitors this time of year, and pumas show less avoidance around trackers — reliable, though not yet the true snow-tracking season.',
    'Fewer visitors this time of year, and pumas show less avoidance around trackers — reliable, though not yet the true snow-tracking season.',
    "Winter puma tracking begins — snow starts making paw prints easy to follow, and guanaco concentrate in the lower valleys within tracking range.",
    'Peak puma-tracking season — dedicated multi-day tracking tours run 80-90% success rates here, the highest of the year, thanks to snow-track visibility and concentrated guanaco herds.',
    'Peak puma-tracking season — dedicated multi-day tracking tours run 80-90% success rates here, the highest of the year, thanks to snow-track visibility and concentrated guanaco herds.',
    'Winter puma tracking eases as snow cover becomes less reliable, though guanaco concentrations are still fairly strong.',
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.',
    'Puma cubs are often visible this month, alongside newborn guanaco young from the recent birthing season.',
    'Puma sightings remain reliable with a dedicated guide, alongside guanaco, condor, and rhea.',
  ],
  yellowstone: [
    'Wolf-watching season is well underway — snow cover makes packs easier to spot against the white backdrop in Lamar Valley. Bison herds remain reliable.',
    'Strong wolf-watching conditions — snowpack keeps elk concentrated at lower elevations, drawing wolves within range of the road.',
    'Peak wolf-watching season — packs are frequently active in daylight against the snow. The best months of the year for a sighting.',
    'Peak wolf-watching season — packs are frequently active in daylight against the snow. The best months of the year for a sighting.',
    'Newborn wildlife peak — bison calves and elk calves are everywhere, one of the best times to be watching.',
    'Still a strong window, as the newborn-wildlife season eases.',
    'Bison herds remain reliable year-round; wolves and bears are a matter of luck.',
    'Bison herds remain reliable year-round; wolves and bears are a matter of luck.',
    'The elk rut peaks — bugling and sparring bulls are a dramatic, reliable sight.',
    'The elk rut is easing but still active.',
    'Bison herds remain reliable year-round; wolves and bears are a matter of luck.',
    'Wolf-watching season is beginning — snow is starting to concentrate elk at lower elevations in Lamar Valley.',
  ],
  'great-smoky-mountains': [
    'Baseline season — black bears are seen year-round, though less active in the coldest months.',
    'Baseline season — black bears are seen year-round, though less active in the coldest months.',
    'Baseline season — black bears are seen year-round, though less active in the coldest months.',
    'Baseline season — black bears are seen year-round, though less active in the coldest months.',
    'The synchronous firefly display is building toward its peak at Elkmont.',
    'Peak firefly season — a genuinely rare, famous spectacle, though it now requires a lottery-won permit to see at Elkmont.',
    'Baseline season — black bears are seen year-round, though less active in the coldest months.',
    'Baseline season — black bears are seen year-round, though less active in the coldest months.',
    'The elk rut peaks at Cataloochee Valley — bugling and sparring bulls are a dramatic, reliable sight at dawn and dusk.',
    'The elk rut is easing but still active at Cataloochee Valley.',
    'Baseline season — black bears are seen year-round, though less active in the coldest months.',
    'Baseline season — black bears are seen year-round, though less active in the coldest months.',
  ],
  'cape-cod-islands': [
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    'Whales are visible offshore as the season begins, though sightings build through the month.',
    'Whales are visible offshore, building toward peak season.',
    'Whales are visible offshore.',
    'Peak whale season at Stellwagen Bank — sighting rates approach 98%.',
    'Peak whale season at Stellwagen Bank — sighting rates approach 98%.',
    'Still peak season — whale numbers are at their maximum, with noticeably smaller crowds than August.',
    'Whales remain visible offshore as the season winds down.',
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
  ],
  rwanda: [
    'The short dry season here — firmer than the rains, but not as reliably dry as June through August. Gorilla sightings themselves remain about as close to guaranteed as wildlife viewing gets.',
    'The short dry season here — firmer than the rains, but not as reliably dry as June through August. Gorilla sightings themselves remain about as close to guaranteed as wildlife viewing gets.',
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged — trackers still locate a habituated family virtually every day.',
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged — trackers still locate a habituated family virtually every day.',
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged — trackers still locate a habituated family virtually every day.',
    'Peak dry season begins — the driest, firmest trail conditions of the year, on par with July and August.',
    'Peak dry season — the driest, firmest trail conditions of the year.',
    'Peak dry season — the driest, firmest trail conditions of the year.',
    'Still within the dry season, easing slightly.',
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged.',
    'Trails are muddier during the rains, but gorilla trekking odds remain essentially unchanged.',
    'The short dry season returning — firmer trails than the rains, though not as reliably dry as the June-August peak.',
  ],
  lofoten: [
    'Orca sightings directly off Lofoten are no longer reliable — the herring run (and most operators) has shifted north to Tromsø and Skjervøy in recent years.',
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    'Seabird cliffs are active with nesting colonies.',
    'Seabird cliffs are active with nesting colonies.',
    'Seabird cliffs are active with nesting colonies.',
    'Seabird cliffs are active with nesting colonies.',
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    'Orca are beginning to arrive, though less reliably than in past years — the herring run has shifted north to Tromsø and Skjervøy.',
    'Orca sightings directly off Lofoten are no longer reliable — the herring run (and most operators) has shifted north to Tromsø and Skjervøy in recent years.',
  ],
  komodo: [
    'Peak manta ray season at the southern aggregation site (Manta Alley) — dragon sightings on the islands themselves remain reliable regardless.',
    'Peak manta ray season at the southern aggregation site (Manta Alley) — dragon sightings on the islands themselves remain reliable regardless.',
    'Manta ray activity easing at the southern site; dragon sightings remain reliably good.',
    'Between manta seasons at the well-known sites; dragon sightings stay reliably good year-round regardless.',
    'Between manta seasons at the well-known sites; dragon sightings stay reliably good year-round regardless.',
    'Between manta seasons at the well-known sites; dragon sightings stay reliably good year-round regardless.',
    "Manta ray activity building at Central Komodo's cleaning stations; dragon sightings remain reliable.",
    "Peak manta ray season at Central Komodo's cleaning stations (Karang Makassar); dragon sightings remain reliable.",
    "Peak manta ray season at Central Komodo's cleaning stations (Karang Makassar); dragon sightings remain reliable.",
    'Manta ray activity easing at Central Komodo; dragon sightings remain reliably good.',
    'Between manta seasons at the well-known sites; dragon sightings stay reliably good year-round regardless.',
    'The southern manta aggregation season is beginning at Manta Alley; dragon sightings remain reliable.',
  ],
  seychelles: [
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
    'Whale sharks are starting to arrive as the trade winds ease, on top of the year-round tortoise sightings.',
    'Peak whale shark season, on top of the year-round tortoise sightings.',
    'Peak whale shark season, on top of the year-round tortoise sightings.',
    "Aldabra giant tortoises remain a reliable year-round sighting on Curieuse Island; whale sharks aren't present.",
  ],
  nicaragua: [
    'Howler monkeys are a real, common sight in the forest reserves.',
    'Howler monkeys are a real, common sight in the forest reserves.',
    'Howler monkeys are a real, common sight in the forest reserves.',
    'Howler monkeys are a real, common sight in the forest reserves.',
    'Howler monkeys are a real, common sight in the forest reserves.',
    'Howler monkeys are a real, common sight in the forest reserves.',
    'Heavier rains make general sightings somewhat less frequent, though the olive ridley arribada season at La Flor is beginning.',
    'Heavier rains make general sightings somewhat less frequent; olive ridley arribadas at La Flor are building toward peak.',
    'Heavier rains make general sightings somewhat less frequent, though this is peak season for olive ridley sea turtles coming ashore to nest at La Flor in large synchronized arrivals.',
    'Heavier rains make general sightings somewhat less frequent, though this is peak season for olive ridley sea turtles coming ashore to nest at La Flor in large synchronized arrivals.',
    'Olive ridley arribadas at La Flor continue, easing from peak, alongside the usual howler-monkey sightings.',
    'Rains ease, and the olive ridley arribada season is winding down at La Flor, though a late arrival is still possible alongside the usual howler-monkey sightings.',
  ],
  'monterey-big-sur': [
    'Elephant seal pupping season is building at Año Nuevo — a genuinely dramatic, reliable sighting as the colony fills in.',
    'Peak elephant seal pupping season at Año Nuevo — a genuinely dramatic, reliable sighting, with males fighting for territory and pups born on the beach.',
    'Elephant seal pupping is easing at Año Nuevo, while the gray whale northbound migration is just beginning — a real overlap between the two.',
    'Peak gray whale migration season, passing close offshore on the northbound journey; the elephant seal colony has largely thinned out.',
    'Still strong gray whale migration season, passing close offshore on the northbound journey.',
    'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
    'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
    'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
    'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
    'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
    'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
    'Elephant seal pupping season is building at Año Nuevo — a genuinely dramatic, reliable sighting as the colony fills in.',
  ],
  maui: [
    'Humpback whale season is just beginning offshore.',
    'Humpback whales are visible offshore, building toward peak.',
    'Peak humpback whale season — the highest whale density of the year, with frequent breaching and competition pods.',
    'Peak humpback whale season — the highest whale density of the year, with frequent breaching and competition pods.',
    'Humpback whales are still visible offshore, though numbers are thinning as the season winds down.',
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    "Wildlife-watching isn't a dedicated focus here outside the seasonal window noted above.",
    'Humpback whale season is just beginning offshore.',
  ],
  hokkaido: [
    'Red-crowned cranes perform their courtship dance on the snow near Kushiro — a famous, only-in-Hokkaido sight.',
    'Red-crowned cranes perform their courtship dance on the snow near Kushiro — a famous, only-in-Hokkaido sight.',
    'Red-crowned cranes remain visible near Kushiro as the winter season winds down.',
    'Baseline season — neither the cranes nor the bear salmon run are active.',
    'Baseline season — neither the cranes nor the bear salmon run are active.',
    'Baseline season — neither the cranes nor the bear salmon run are active.',
    'Baseline season — neither the cranes nor the bear salmon run are active.',
    'Baseline season — neither the cranes nor the bear salmon run are active.',
    "Brown bears gather at Shiretoko's river mouths to fish for salmon, visible on coastal boat cruises.",
    "Brown bears gather at Shiretoko's river mouths to fish for salmon, visible on coastal boat cruises.",
    'Baseline season — neither the cranes nor the bear salmon run are active.',
    'Red-crowned cranes are gathering at feeding stations near Kushiro as the winter season begins.',
  ],
  kenya: [
    'Lions and elephants remain near-certain sightings at this strong baseline.',
    'Lions and elephants remain near-certain sightings at this strong baseline.',
    'The migration has moved on; lions and elephants remain near-certain, though overall wildlife density eases slightly.',
    'The migration has moved on; lions and elephants remain near-certain, though overall wildlife density eases slightly.',
    'The migration has moved on; lions and elephants remain near-certain, though overall wildlife density eases slightly.',
    "The Great Migration's river crossings are beginning as herds arrive from the south.",
    "The Great Migration's river crossings are building steadily, though they're still on their own schedule this early in the season — not yet as reliable as August. Lions and elephants remain near-certain.",
    'Peak river-crossing season — dramatic, though the crossings happen on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.',
    'Peak river-crossing season — dramatic, though the crossings happen on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.',
    'Peak river-crossing season — dramatic, though the crossings happen on their own schedule, not guaranteed on any single day. Lions and elephants remain near-certain.',
    'The migration has moved south again; lions and elephants remain near-certain sightings.',
    'The migration has moved south again; lions and elephants remain near-certain sightings.',
  ],
  kerala: [
    'Odds are building as the dry season begins.',
    'Good, strengthening odds at the Periyar reservoir as the dry season progresses.',
    'Elephant sightings continue strengthening at the Periyar reservoir.',
    'Peak season — the driest point of the year, when elephant herds are most concentrated at the Periyar reservoir.',
    'Monsoon conditions disperse wildlife more widely; elephant sightings are less concentrated.',
    'Monsoon conditions disperse wildlife more widely; elephant sightings are less concentrated.',
    'Monsoon conditions disperse wildlife more widely; elephant sightings are less concentrated.',
    'Monsoon conditions disperse wildlife more widely; elephant sightings are less concentrated.',
    'Odds are building as the dry season approaches.',
    'Odds are building as the dry season approaches.',
    'Still good odds as the dry season eases.',
    'Odds are building as the dry season begins.',
  ],
  ladakh: [
    'The high valleys are snowed shut — no access to Hemis National Park.',
    'The high valleys are snowed shut — no access to Hemis National Park.',
    'Peak snow leopard tracking season, right as the valleys reopen — still a rare sighting even now, but the best odds of the year.',
    'Blue sheep and other high-altitude wildlife are reliably visible; snow leopard sightings remain rare outside the March peak.',
    'Blue sheep and other high-altitude wildlife are reliably visible; snow leopard sightings remain rare outside the March peak.',
    'Blue sheep and other high-altitude wildlife are reliably visible; snow leopard sightings remain rare outside the March peak.',
    'Blue sheep and other high-altitude wildlife are reliably visible; snow leopard sightings remain rare outside the March peak.',
    'Blue sheep and other high-altitude wildlife are reliably visible; snow leopard sightings remain rare outside the March peak.',
    'Blue sheep and other high-altitude wildlife are reliably visible; snow leopard sightings remain rare outside the March peak.',
    'Blue sheep and other high-altitude wildlife are reliably visible; snow leopard sightings remain rare outside the March peak.',
    "The snow leopard tracking season is beginning as the cold pushes leopards' prey down into the lower valleys — sightings remain rare, but this is a real, if early, window before the valleys close for winter.",
    'The high valleys are snowed shut — no access to Hemis National Park.',
  ],
  namibia: [
    'Wildlife is more dispersed during the rains; cheetah and general sightings are at their least concentrated.',
    'Wildlife is more dispersed during the rains; cheetah and general sightings are at their least concentrated.',
    'Wildlife is more dispersed during the rains; cheetah and general sightings are at their least concentrated.',
    'Conditions are beginning to improve as the dry season approaches.',
    'Wildlife concentrations are building toward their peak.',
    'Wildlife concentrations are building toward their peak.',
    'Peak dry season — cheetah sightings and general wildlife concentrations around remaining water are at their strongest. Desert-adapted elephant and black rhino tracking in Damaraland works year-round.',
    'Peak dry season — cheetah sightings and general wildlife concentrations around remaining water are at their strongest. Desert-adapted elephant and black rhino tracking in Damaraland works year-round.',
    'Peak dry season — cheetah sightings and general wildlife concentrations around remaining water are at their strongest. Desert-adapted elephant and black rhino tracking in Damaraland works year-round.',
    'Concentrations remain strong as the dry season nears its end — September and October are widely considered the peak, with waterhole density at its most dramatic.',
    'Rains are returning, dispersing wildlife across a wider area.',
    'Rains are returning, dispersing wildlife across a wider area.',
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
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const missing = Object.keys(MONTHLY).filter((id) => MONTHLY[id].length !== 12);
  if (missing.length) { console.error('Bad monthly arrays:', missing); process.exit(1); }

  const ids = Object.keys(EVENTS);
  for (const id of ids) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: EVENTS[id] },
    };
    if (OVERVIEWS[id]) patch.sliderOverview = { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] };
    if (MONTHLY[id]) patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: MONTHLY[id] };

    // Re-derive with the new events applied and refit sliderCurves — the
    // audit/production read path (deriveDestinationScoresFromCurves) reads
    // the stored curve snapshot, not a live recomputation. See the
    // anchor-ceiling lesson in fix-diving-refit-curves.ts.
    const scoringRow = { ...row, ...patch };
    const scoring = toScoringPlace(scoringRow as typeof row);
    const monthly = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
    patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve };

    console.log(`${id}: [${monthly.map((v: number) => v.toFixed(0)).join(',')}] peak=${Math.max(...monthly)}`);

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
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
