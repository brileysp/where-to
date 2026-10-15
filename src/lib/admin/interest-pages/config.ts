import { z } from 'zod';
import type { InterestFactValue } from '@/lib/db/schema';

/**
 * What each per-interest admin page shows in its "Places & data" table, beyond
 * the columns every interest gets. Interests with no entry here get only the
 * generic columns (place, region, peak, season, status, last review).
 */

export type FactType = 'int' | 'rating' | 'text' | 'draw' | 'bool' | 'birds' | 'list' | 'choice' | 'multi' | 'likelihood';
export type FactGroup = 'data' | 'draw' | 'planning' | 'species' | 'style' | 'experience' | 'practical' | 'waves' | 'trails';

export interface FactOption {
  value: string;
  label: string;
}

/** Five-level sighting odds, in order from best to worst. Used by safari's animal grid. */
export const LIKELIHOODS: FactOption[] = [
  { value: 'guaranteed', label: 'Guaranteed' },
  { value: 'likely', label: 'Likely' },
  { value: 'possible', label: 'Possible' },
  { value: 'unlikely', label: 'Unlikely' },
  { value: 'notPresent', label: 'Not present' },
];
const LIKELIHOOD_WEIGHT: Record<string, number> = { guaranteed: 4, likely: 3, possible: 2, unlikely: 1, notPresent: 0 };

export interface FactDef {
  key: string;
  label: string;
  type: FactType;
  group: FactGroup;
  hint?: string;
  /** Allowed values for 'choice' and 'multi' columns ('likelihood' always uses LIKELIHOODS). 'multi' stores a list of the chosen values. */
  options?: FactOption[];
  /** Draw a wide text box for long free text. */
  wide?: boolean;
  /** Free text in the form "Animal (likelihood), Animal (likelihood)"; the column sorts by the best odds in the cell. */
  animals?: boolean;
  /** Stored and validated, but no column is drawn for it. */
  hidden?: boolean;
  /** A column that may legitimately stay blank for every place (notes for Gemini, say): never counted in completeness. */
  optional?: boolean;
  /** Overrides the default length limit for a text column. */
  maxLength?: number;
}

export const FACT_GROUP_LABELS: Record<FactGroup, { label: string; tone: 'app' | 'info' | 'draw' | 'new' }> = {
  data: { label: 'Birding data', tone: 'app' },
  species: { label: 'Animals: how likely', tone: 'app' },
  style: { label: 'Style and rules', tone: 'info' },
  experience: { label: 'Experience', tone: 'app' },
  practical: { label: 'Practicalities', tone: 'info' },
  waves: { label: 'Waves', tone: 'app' },
  trails: { label: 'Trails', tone: 'app' },
  draw: { label: 'Draw', tone: 'draw' },
  planning: { label: 'Not collected yet', tone: 'new' },
};

export const DRAW_RATINGS = ['strong', 'moderate', 'weak'] as const;

const BIRDING_FACTS: FactDef[] = [
  { key: 'species', label: 'Species', type: 'int', group: 'data', hint: "Approximate species total for the place's own scope (not the whole country)." },
  { key: 'endemicSpecies', label: 'Endemic species (strict)', type: 'int', group: 'data', hint: "Living species found nowhere else in the world, counted for the place's own country, island or island group (Clements/AOS/SACC lists). Blank where the place is only part of a wider endemic region: use the regional column for that." },
  { key: 'endemicSpeciesRegional', label: 'Endemic species (regional)', type: 'int', group: 'data', hint: "Living species found nowhere else in the world outside the wider endemic region the place sits in (for example the Albertine Rift, Atlantic Forest, Western Ghats, Iberia or Patagonian Andes), so it includes species shared with neighbouring countries." },
  { key: 'endemicFamilies', label: 'Endemic families', type: 'int', group: 'data', hint: 'Whole bird families found nowhere else outside the place\'s country, island or island group, and readily found there (Clements). Madagascar has five.' },
  { key: 'charisma', label: 'Charisma', type: 'rating', group: 'data', hint: '0-10. Birds worth looking at: color, size, behavior, drama.' },
  {
    key: 'viewsPhoto',
    label: 'Close-up / photo ease',
    type: 'rating',
    group: 'data',
    hint: '0-10. How easy it is to get close, clean views and photos. Birding: very high (10) for great feeder setups, e.g. Ecuadorian Andes, Costa Rica; high (8) for Galápagos; low (1-3) for craning at birds high in the canopy or shooting through dense undergrowth.',
  },
  { key: 'spectacle', label: 'Spectacle', type: 'rating', group: 'data', hint: '0-10. Mass concentrations: colonies, migration bottlenecks, roosts.' },
  { key: 'draw', label: 'Draw', type: 'draw', group: 'draw', hint: 'How strong a pull the birds are for a trip.' },
  { key: 'headlineBirds', label: 'Headline birds', type: 'text', group: 'draw', wide: true, animals: true, hint: 'The birds that make the trip. Format: Bird (likelihood), Bird (likelihood). Likelihood is guaranteed, likely, possible or unlikely for a few days at the best time of year; add "not present" only to record a bird people expect that is not there.' },
  { key: 'drawSourceChecked', label: 'Source-checked', type: 'bool', group: 'draw', hint: 'Whether the draw birds were checked against a source.' },
  { key: 'daysNeeded', label: 'Days needed', type: 'text', group: 'planning' },
  { key: 'guide', label: 'Guide needed?', type: 'text', group: 'planning' },
  { key: 'selfDrive', label: 'Self-drive?', type: 'text', group: 'planning' },
  { key: 'spread', label: 'How spread out', type: 'text', group: 'planning' },
  { key: 'access', label: 'Accessibility', type: 'text', group: 'planning' },
  // Kept from the old model script so nothing is lost; no column yet.
  { key: 'drawConfidence', label: 'Draw confidence', type: 'text', group: 'draw', hidden: true },
  { key: 'endemismRating', label: 'Endemism rating (0-10)', type: 'rating', group: 'data', hidden: true },
  { key: 'lineageRating', label: 'Lineage rating (0-10)', type: 'rating', group: 'data', hidden: true },
];


const yn = (a = 'Yes', b = 'No'): FactOption[] => [{ value: 'yes', label: a }, { value: 'no', label: b }];
const lk = (key: string, label: string, hint?: string): FactDef => ({ key, label, type: 'likelihood', group: 'species', hint: hint ?? `${label}: how likely a typical 3 to 4 day visit in the best season is to see one.` });

const SAFARI_FACTS: FactDef[] = [
  lk('lion', 'Lion'),
  lk('leopard', 'Leopard'),
  lk('elephant', 'Elephant', 'African or Asian elephant.'),
  lk('rhino', 'Rhino', 'Any wild rhino, including the Indian one-horned rhino.'),
  lk('cheetah', 'Cheetah'),
  lk('wildDog', 'Wild dog', 'African wild dog.'),
  lk('giraffe', 'Giraffe'),
  lk('hippo', 'Hippo'),
  lk('herds', 'Great herds', 'Great herds or a migration: wildebeest, zebra, or similar mass gatherings.'),
  lk('tiger', 'Tiger', 'Regional headliner for Asia.'),
  { key: 'otherMegafauna', label: 'Other megafauna', type: 'text', group: 'species', wide: true, animals: true, hint: 'Large animals not in the grid: apes (gorillas, chimpanzees, orangutans), bears, jaguar, tapir, hyenas, zebra, and buffalo or crocodilians only where they are one of the top five reasons to go. Format: Animal (likelihood), Animal (likelihood). Same five likelihood words. No monkeys, no small animals.' },
  { key: 'selfDrive', label: 'Self-drive', type: 'choice', group: 'style', options: [{ value: 'yes', label: 'Yes' }, { value: 'partly', label: 'Partly' }, { value: 'no', label: 'No' }], hint: 'Can visitors drive themselves around the park?' },
  { key: 'walking', label: 'Walking safaris', type: 'choice', group: 'style', options: [{ value: 'yes', label: 'Yes' }, { value: 'limited', label: 'Limited' }, { value: 'no', label: 'No' }] },
  { key: 'nightDrives', label: 'Night drives', type: 'choice', group: 'style', options: yn() },
  { key: 'offRoad', label: 'Off-road driving', type: 'choice', group: 'style', options: yn(), hint: 'Usually only in private concessions.' },
  { key: 'boat', label: 'Boat or canoe', type: 'choice', group: 'style', options: yn() },
  { key: 'landModel', label: 'Land model', type: 'choice', group: 'style', options: [{ value: 'nationalPark', label: 'National park' }, { value: 'privateConcessions', label: 'Private concessions' }, { value: 'mix', label: 'Mix' }] },
  { key: 'access', label: 'Access', type: 'choice', group: 'style', options: [{ value: 'road', label: 'Road' }, { value: 'flyIn', label: 'Fly-in' }, { value: 'mixed', label: 'Mixed' }] },
  { key: 'crowding', label: 'Crowding', type: 'choice', group: 'experience', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }], hint: 'How many vehicles gather at a typical sighting.' },
  { key: 'density', label: 'Wildlife density', type: 'rating', group: 'experience', hint: '0-10. How much large wildlife a visit finds.' },
  { key: 'closeUp', label: 'Close-up / photo ease', type: 'rating', group: 'experience', hint: '0-10. How easy it is to get close, clean views and photos.' },
  { key: 'spectacle', label: 'Spectacle', type: 'rating', group: 'experience', hint: '0-10. Migrations, calving, gatherings, mass concentrations.' },
  { key: 'malaria', label: 'Malaria', type: 'choice', group: 'practical', options: [{ value: 'none', label: 'None' }, { value: 'low', label: 'Low' }, { value: 'seasonal', label: 'Seasonal' }, { value: 'high', label: 'High' }], hint: 'None; low; seasonal (high in the wet months, low in the dry-season safari months); high (year-round). Check with a travel clinic.' },
  { key: 'draw', label: 'Draw', type: 'draw', group: 'draw', hint: 'How strong a pull the wildlife is for a trip.' },
  { key: 'headlineAnimals', label: 'Headline animals', type: 'list', group: 'draw', hint: 'Comma-separated.' },
  { key: 'drawSourceChecked', label: 'Source-checked', type: 'bool', group: 'draw', hint: 'Whether these entries were checked against a source.' },
  { key: 'spread', label: 'How spread out', type: 'text', group: 'planning' },
];

/** "Likely or better: n of 10" for the safari animal grid. */
export function sightingsCount(defs: FactDef[], facts: Record<string, InterestFactValue>): { good: number; total: number; recorded: number } {
  const lks = defs.filter((d) => d.type === 'likelihood');
  let good = 0;
  let recorded = 0;
  for (const d of lks) {
    const v = facts[d.key];
    if (typeof v !== 'string') continue;
    recorded++;
    if ((LIKELIHOOD_WEIGHT[v] ?? 0) >= 3) good++;
  }
  return { good, total: lks.length, recorded };
}
export const likelihoodRank = (v: unknown) => (typeof v === 'string' ? LIKELIHOOD_WEIGHT[v] ?? -1 : -1);

/** Human label for a stored choice or likelihood value. */
export function optionLabel(def: FactDef, v: InterestFactValue | undefined): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.map((x) => optionLabel(def, x)).join(', ');
  const opts = def.type === 'likelihood' ? LIKELIHOODS : def.options;
  return opts?.find((o) => o.value === v)?.label ?? String(v);
}

export function optionsFor(def: FactDef): FactOption[] {
  return def.type === 'likelihood' ? LIKELIHOODS : def.options ?? [];
}


const animalCol = (key: string, label: string, hint: string): FactDef => ({ key, label, type: 'text', group: 'species', wide: true, animals: true, hint: `${hint} Format: Animal (likelihood), Animal (likelihood). Likelihood is guaranteed, likely, possible or unlikely for a 3 to 4 day visit in the best season. If the animal is habituated or fed, add that inside the brackets after the likelihood, for example "Mountain gorilla (guaranteed, habituated)" or "(likely, fed)". Use one or the other, never both.` });

const WILDLIFE_FACTS: FactDef[] = [
  animalCol('predators', 'Predators', 'Big cats, bears, wolves, hyenas, big reptiles that hunt, and similar.'),
  animalCol('herbivores', 'Large herbivores', 'Elephants, rhinos, bison, deer, antelope, giraffes, wild horses, and similar.'),
  animalCol('primates', 'Primates', 'Apes, monkeys and lemurs. Name the standouts when there are clear ones (proboscis monkey, indri); otherwise give a count, for example "13 monkey species".'),
  animalCol('birds', 'Birds', 'Only the birds that are a wildlife draw (penguins, puffins, raptors, flamingos). Full bird lists belong to Birding.'),
  animalCol('herps', 'Reptiles and amphibians', 'Tortoises, iguanas, crocodilians, snakes, chameleons, frogs.'),
  animalCol('marineLife', 'Marine life', 'Seals, sea lions, whales, dolphins, turtles, manta rays and similar. Repeats with Whale Watching and Diving are fine.'),
  animalCol('otherMammals', 'Other', 'Anything that fits none of the groups (sloths, anteaters, pandas, kangaroos, small mammals only if a real draw).'),
  { key: 'howWatch', label: 'How you watch', type: 'multi', group: 'style', options: [{ value: 'vehicle', label: 'Vehicle' }, { value: 'onFoot', label: 'On foot' }, { value: 'boat', label: 'Boat' }, { value: 'hide', label: 'Hide or platform' }, { value: 'water', label: 'Snorkel or dive' }], hint: 'The ways people see the animals. Pick every one that matters; there is no "mixed".' },
  { key: 'density', label: 'Density', type: 'rating', group: 'experience', hint: '0-10. How much wildlife a visit finds.' },
  { key: 'closeUp', label: 'Close-up / photo ease', type: 'rating', group: 'experience', hint: '0-10. How easy it is to get close, clean views and photos.' },
  { key: 'spectacle', label: 'Spectacle', type: 'rating', group: 'experience', hint: '0-10. Migrations, mass gatherings, colonies, a once-in-a-lifetime event.' },
  { key: 'draw', label: 'Draw', type: 'draw', group: 'draw', hint: 'How strong a pull the wildlife is for a trip.' },
  { key: 'drawSourceChecked', label: 'Source-checked', type: 'bool', group: 'draw', hint: 'Whether these entries were checked against a source.' },
];

const whaleCol = (key: string, label: string, hint: string): FactDef => ({ key, label, type: 'text', group: 'species', wide: true, animals: true, hint: `${hint} Format: Name (likelihood, months), for example "Humpback whale (likely, Jun–Sep)". Likelihood is guaranteed, likely, possible or unlikely for a boat trip of a few days at the best time of year. Give the months the animal is there, or "year-round". A place can list a few kinds in one cell.` });

const WHALE_FACTS: FactDef[] = [
  whaleCol('humpback', 'Humpback whale', 'Humpback whales.'),
  whaleCol('sperm', 'Sperm whale', 'Sperm whales.'),
  whaleCol('minke', 'Minke whale', 'Minke whales, including Antarctic and dwarf minke.'),
  whaleCol('orca', 'Orca', 'Orcas, with the population type when it matters (resident, transient).'),
  whaleCol('blue', 'Blue whale', 'Blue whales.'),
  whaleCol('fin', 'Fin whale', 'Fin whales.'),
  whaleCol('gray', 'Gray whale', 'Gray whales.'),
  whaleCol('right', 'Right whales', 'Southern, North Atlantic and North Pacific right whales.'),
  whaleCol('otherWhales', 'Other whales', "Bryde's, sei, pilot, beluga, narwhal, bowhead, beaked whales and any other whale not in its own column."),
  whaleCol('dolphins', 'Dolphins & porpoises', 'Wild sea dolphins and porpoises. River dolphins are not counted here; they belong to Wildlife Viewing. Kept separate so a traveler who only likes whales is not matched on these.'),
  { key: 'watchShore', label: 'Watch from shore', type: 'bool', group: 'style', hint: 'Whales or dolphins can be watched from a lookout or the shore, not only from a boat.' },
  { key: 'boatStyle', label: 'Boat style', type: 'choice', group: 'style', options: [{ value: 'inflatable', label: 'Small inflatable' }, { value: 'midsize', label: 'Mid-size boat' }, { value: 'large', label: 'Large vessel' }, { value: 'sailing', label: 'Sailing' }, { value: 'mixed', label: 'Several styles' }], hint: 'The usual kind of boat for the trips.' },
  { key: 'swimAllowed', label: 'Swim with whales', type: 'bool', group: 'style', hint: 'Regulated swimming with wild whales or dolphins is offered. Leave unticked if it is banned or only captive.' },
  { key: 'closeness', label: 'Encounter closeness', type: 'rating', group: 'experience', hint: '0-10. How close and long the encounters are: breaching, calves, whales approaching the boat.' },
  { key: 'seasick', label: 'Seasickness risk', type: 'rating', group: 'experience', hint: '0-10. 10 means the usual sea is very rough for a boat trip.' },
  { key: 'draw', label: 'Draw', type: 'draw', group: 'draw', hint: 'How strong a pull the whales are for a trip.' },
  { key: 'drawSourceChecked', label: 'Source-checked', type: 'bool', group: 'draw', hint: 'Whether these entries were checked against a source.' },
];

// Snorkeling & diving. The fit columns (diving rating, snorkeling rating, best for) are written by the Gemini run (diving_rating,
// snorkeling_rating, best_for) and later let the onboarding adjust scores for travelers who prefer one discipline; they do not change any
// score today. The "typical dive" baseline is a certified Open Water diver on a day boat doing two dives at 10 to 30 m in warm water, plus a
// guided snorkeler on the same boat. The format columns say how a place differs from that baseline; the text only calls out a difference.
const DIVING_FACTS: FactDef[] = [
  { key: 'divingRating', label: 'Diving rating', type: 'rating', group: 'experience', hint: '0-10. How good the place is for scuba at its best time of year, on its own (a place with no diving worth doing is 0-1).' },
  { key: 'snorkelingRating', label: 'Snorkeling rating', type: 'rating', group: 'experience', hint: '0-10. How good the place is for snorkeling at its best time of year, on its own (a place with nothing worth snorkeling is 0-1).' },
  { key: 'bestFor', label: 'Best for', type: 'choice', group: 'experience', options: [{ value: 'both', label: 'Both about equally' }, { value: 'diving', label: 'Diving-led' }, { value: 'snorkeling', label: 'Snorkeling-led' }], hint: 'Diving-led or snorkeling-led when one rating is 1.5 or more above the other, otherwise both.' },
  { key: 'drawType', label: 'What the draw is', type: 'choice', group: 'style', options: [{ value: 'reef', label: 'Coral reef (typical)' }, { value: 'animals', label: 'Animals over rock or open water' }, { value: 'wrecks', label: 'Wrecks' }, { value: 'caves', label: 'Caves and cenotes' }, { value: 'kelp', label: 'Kelp and cold-water reef' }, { value: 'mixed', label: 'Several equally' }, { value: 'other', label: 'Something else (a spring, a rift, ice)' }], hint: 'What the visitor mostly goes underwater for. Coral reef is the norm and needs no mention; a place that is about being in the water with animals, not coral scenery, is called out in the text.' },
  { key: 'accessStyle', label: 'How you do it', type: 'multi', group: 'style', options: [{ value: 'dayBoat', label: 'Day boat (typical)' }, { value: 'shore', label: 'Shore or house reef' }, { value: 'liveaboard', label: 'Liveaboard' }], hint: 'Every way a visitor usually reaches the best sites: pick all that apply. Day boat is the norm and needs no mention; shore and liveaboard are the variants.' },
  { key: 'certification', label: 'Certification needed', type: 'choice', group: 'style', options: [{ value: 'none', label: 'None (snorkeling or intro dives)' }, { value: 'openWater', label: 'Open Water (typical)' }, { value: 'advanced', label: 'Advanced (deeper sites)' }, { value: 'specialty', label: 'Specialty training (cave, wreck, technical)' }], hint: 'What the headline sites need. Open Water is the norm; anything else is called out in the text.' },
  { key: 'typicalDepth', label: 'Typical depth', type: 'text', group: 'style', hint: 'Depth range of the main sites in feet, e.g. 30-80 ft. Over 100 ft, or shallower than 30 ft, is unusual.' },
  { key: 'current', label: 'Current', type: 'choice', group: 'style', options: [{ value: 'none', label: 'Little or none' }, { value: 'mild', label: 'Mild' }, { value: 'moderate', label: 'Moderate' }, { value: 'strong', label: 'Strong (drift dives)' }], hint: 'How strong the water movement usually is at the main sites. Strong current is called out; mild or none is the norm.' },
  { key: 'waterTemp', label: 'Water temperature', type: 'text', group: 'style', hint: 'Range in degrees F across the year, with the suit if unusual, e.g. 79-86 F, or 46-57 F (drysuit). Warm water in a thin wetsuit is the norm.' },
  { key: 'animals', label: 'Signature animals', type: 'text', group: 'species', animals: true, wide: true, hint: 'What you can get in the water with, as "Animal (likelihood, months)", e.g. "Manta ray (likely, Dec-Apr), Whale shark (possible, Jun-Sep)". Include whales and dolphins only where entering the water with them is allowed.' },
  { key: 'drawSourceChecked', label: 'Source-checked', type: 'bool', group: 'draw', hint: 'Whether these entries were checked against a source.' },
];

/**
 * Snorkeling & diving: does this place differ from the typical dive (coral reef, day boat, Open Water, 10-30 m, little or mild
 * current, warm water), and how? Calculated from the other columns, never typed, so Gemini is told exactly what to call out and
 * does not have to guess. An empty list means typical: the text should not describe the format.
 */
export function divingFormatCallouts(facts: Record<string, InterestFactValue>): { recorded: boolean; reasons: string[] } {
  const str = (k: string) => (typeof facts[k] === 'string' ? (facts[k] as string) : '');
  // "How you do it" is a multi-select (13 Oct 2026); an older single word is read as a one-item list.
  const rawAccess = facts.accessStyle;
  const access = Array.isArray(rawAccess) ? rawAccess.map(String) : typeof rawAccess === 'string' && rawAccess && rawAccess !== 'mixed' ? [rawAccess] : [];
  if (access.length === 0 && !str('certification')) return { recorded: false, reasons: [] };
  const r: string[] = [];
  // A day boat among the ways makes the place typical on access; without one, the variant is called out.
  if (!access.includes('dayBoat')) {
    if (access.includes('liveaboard') && access.includes('shore')) r.push('shore or house-reef diving, or a liveaboard (a multi-day dive boat to remote sites); no day boats');
    else if (access.includes('liveaboard')) r.push('liveaboard only (a multi-day dive boat to remote sites)');
    else if (access.includes('shore')) r.push('shore or house-reef diving, no boat needed');
  }
  const cert = str('certification');
  if (cert === 'none') r.push('no certification needed (snorkeling or introductory dives only)');
  else if (cert === 'advanced') r.push('the main sites need Advanced certification');
  else if (cert === 'specialty') r.push('specialty training needed (cave, wreck, technical, drysuit or ice)');
  if (str('current') === 'strong') r.push('strong current (drift diving)');
  const depth = /(\d+)(?:\s*-\s*(\d+))?/.exec(str('typicalDepth'));
  if (depth) {
    const max = Number(depth[2] ?? depth[1]);
    if (max > 100) r.push(`deep main sites (to ${max} ft)`);
    else if (max < 30) r.push('everything is very shallow');
  }
  const temp = str('waterTemp');
  const temps = [...temp.matchAll(/(?<!\d)(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const hi = temps.length ? Math.max(...temps.slice(0, 2)) : null;
  if (/drysuit|7 mm/i.test(temp) || (hi !== null && hi < 68)) r.push(`cold water (${temp.replace(/\s*\(.*\)/, '')})`);
  const draw = str('drawType');
  if (draw === 'animals') r.push('the draw is animals over rock or open water, not coral reef');
  else if (draw === 'wrecks') r.push('the draw is wrecks');
  else if (draw === 'caves') r.push('the draw is caves and cenotes');
  else if (draw === 'kelp') r.push('the draw is kelp forest and cold-water reef');
  else if (draw === 'other') r.push('the draw is unusual rather than a reef (for example a spring, a rift, ice, a lake or interesting rock formations)');
  const animals = str('animals');
  if (/baited|cage/i.test(animals)) r.push('some animal encounters are baited or in a cage');
  if (/in-water swim/i.test(animals)) r.push('regulated in-water swims with whales or dolphins');
  return { recorded: true, reasons: r };
}

/** Best odds named in an "Animal (likelihood), ..." cell: 4 guaranteed, 3 likely, 2 possible, 1 unlikely, -1 none. */
export function bestOdds(text: unknown): number {
  if (typeof text !== 'string') return -1;
  let best = -1;
  for (const m of text.matchAll(/\((guaranteed|likely|possible|unlikely)/gi)) best = Math.max(best, LIKELIHOOD_WEIGHT[m[1].toLowerCase()] ?? -1);
  return best;
}

// Surfing. Added 11 Oct 2026. Units are feet and degrees Fahrenheit from the start. "Best months" and "seasonal notes" are banned
// columns (they duplicate the monthly text), so the only months here are the per-break ones inside the breaks cell.
const SURFING_FACTS: FactDef[] = [
  { key: 'breaks', label: 'Signature breaks', type: 'text', group: 'waves', wide: true, hint: 'The real waves a trip is built around, 3 to 5 of them, as "Break (type, level, months)", e.g. "Pipeline (reef, expert, Nov-Feb); Waikiki (beach, beginner, Apr-Sep)". Type is beach, point, reef or river mouth. Level is beginner, intermediate or expert. Months are when it works, or year-round.' },
  { key: 'waveType', label: 'Wave type', type: 'choice', group: 'style', options: [{ value: 'beach', label: 'Beach break' }, { value: 'point', label: 'Point break' }, { value: 'reef', label: 'Reef break' }, { value: 'rivermouth', label: 'River mouth' }, { value: 'mixed', label: 'Several types' }], hint: 'The type of wave the place is known for. If two or more types matter equally, pick Several types.' },
  { key: 'beginnerRating', label: 'Beginner rating', type: 'rating', group: 'experience', hint: '0-10. How good the place is for someone learning to surf, at its best time of year, on its own (soft waves, sandy bottom, schools and rentals nearby). A place with no beginner waves is 0-1.' },
  { key: 'advancedRating', label: 'Advanced rating', type: 'rating', group: 'experience', hint: '0-10. How good the place is for experienced surfers, at its best time of year, on its own (wave quality, power, variety). A place with nothing to challenge them is 0-1.' },
  { key: 'hazards', label: 'Main hazards', type: 'text', group: 'style', wide: true, hint: 'The one to three things that most often hurt or surprise a visitor, e.g. "Shallow reef, strong rips, localism, sharks". Plain words, no sentences.' },
  { key: 'waveSize', label: 'Typical wave size', type: 'text', group: 'style', hint: 'Face height in feet on an ordinary good day, then the big-day figure if it differs, e.g. "2-5 ft; 10+ ft on big winter days".' },
  { key: 'waterTemp', label: 'Water temperature and wetsuit', type: 'text', group: 'style', hint: 'Range in degrees F across the year, then the suit, e.g. "78-84 F, boardshorts" or "48-58 F, 5/4 mm hooded wetsuit".' },
  { key: 'crowds', label: 'Crowds in the water', type: 'choice', group: 'style', options: [{ value: 'quiet', label: 'Quiet' }, { value: 'moderate', label: 'Moderate' }, { value: 'crowded', label: 'Crowded at the main breaks' }], hint: 'How busy the headline breaks usually are in the surf season. Localism has its own column.' },
  { key: 'localism', label: 'Localism', type: 'choice', group: 'style', options: [{ value: 'welcoming', label: 'Welcoming' }, { value: 'mixed', label: 'Mixed' }, { value: 'protective', label: 'Protective of the main breaks' }, { value: 'hostile', label: 'Hostile to outsiders' }], hint: 'How locals treat visitors in the water at the headline breaks (Surfline calls this the local vibe). Not the same as crowds, and not a hazard to describe in words.' },
  { key: 'consistency', label: 'Consistency', type: 'choice', group: 'style', options: [{ value: 'yearRound', label: 'Waves most days' }, { value: 'seasonal', label: 'A clear season, flat otherwise' }, { value: 'fickle', label: 'Needs the right swell and wind' }], hint: 'How reliably the place has rideable waves when you arrive in its season.' },
  { key: 'waveDirection', label: 'Wave direction', type: 'choice', group: 'waves', options: [{ value: 'lefts', label: 'Mostly lefts' }, { value: 'rights', label: 'Mostly rights' }, { value: 'both', label: 'Both' }], hint: 'Which way the signature breaks peel, as seen from the water. Regular and goofy-footed surfers choose on this. Both when it differs by break.' },
  { key: 'boards', label: 'Boards to bring', type: 'multi', group: 'waves', options: [{ value: 'longboard', label: 'Longboard or fun board' }, { value: 'shortboard', label: 'Shortboard' }, { value: 'stepUp', label: 'Step-up or gun' }], hint: 'The boards that suit the place. Pick every one that applies; a step-up or gun is for big or hollow waves.' },
  { key: 'access', label: 'How you reach the waves', type: 'choice', group: 'practical', options: [{ value: 'walkUp', label: 'Walk or short paddle' }, { value: 'drive', label: 'Drive or ride to the breaks' }, { value: 'boat', label: 'Boat needed' }, { value: 'resort', label: 'Resort or camp access' }, { value: 'remote', label: 'Remote expedition' }], hint: 'How most visitors get to the signature breaks. Boat needed: the main breaks cannot be reached from shore. Remote: a long, hard trip in.' },
  { key: 'lessons', label: 'Lessons and board rental', type: 'choice', group: 'practical', options: [{ value: 'plentiful', label: 'Plentiful' }, { value: 'some', label: 'Some' }, { value: 'few', label: 'Few or none' }], hint: 'How easily a visitor finds a surf school, a rental board and a wetsuit on the spot. Separate from the beginner rating, which is about the waves.' },
  { key: 'permits', label: 'Permits, fees or limits', type: 'text', group: 'practical', wide: true, hint: 'Anything that restricts or charges for surfing: park passes, breaks run by resorts, daily caps, reef fees paid to landowners, access only with an operator. Blank when there is nothing.' },
  { key: 'drawSourceChecked', label: 'Source-checked', type: 'bool', group: 'draw', hint: 'Whether these entries were checked against a source.' },
];

/**
 * Hiking & Trekking columns (owner decisions 13 Oct 2026: the core eight plus Crowds). Built empty on purpose: they are filled later from web sources.
 * Drafted in docs/hiking-columns-draft.md. Three more are held back for later: longest trek in days, guide needed, how you reach the trails.
 */
const HIKING_FACTS: FactDef[] = [
  { key: 'topTrails', label: 'Signature trails', type: 'text', group: 'trails', wide: true, maxLength: 700, hint: 'The routes a trip is built around, 3 to 5 of them, as "Route (type, length, difficulty, months)", e.g. "Alta Via 1 (hut-to-hut trek, about 75 miles, 10 days, trek, Jul-Sep); Tre Cime loop (day hike, about 6 miles, moderate, Jun-Oct)". Type is day hike, loop, point-to-point, multi-day trek, hut-to-hut or walk-up summit. Difficulty is easy, moderate, strenuous, trek or expedition trek (see the rules tab). Miles and feet.' },
  { key: 'ways', label: 'What you can do', type: 'multi', group: 'trails', options: [{ value: 'easyWalks', label: 'Easy walks' }, { value: 'dayHikes', label: 'Day hikes' }, { value: 'hutTreks', label: 'Hut-to-hut or lodge treks' }, { value: 'campTreks', label: 'Camping treks' }, { value: 'summits', label: 'Walk-up summits' }], hint: 'Every kind of walking a visitor can do here: pick all that apply. A walk-up summit needs no rope, crampons or ice axe; one that does belongs to Mountaineering.' },
  { key: 'howReach', label: 'How you reach the trails', type: 'multi', group: 'trails', options: [{ value: 'trailhead', label: 'Drive to a trailhead' }, { value: 'lifts', label: 'Cable car, gondola or chairlift' }, { value: 'shuttle', label: 'Shuttle or bus to the trailhead' }, { value: 'boat', label: 'Boat or ferry' }, { value: 'train', label: 'Train or cog railway' }, { value: 'flight', label: 'Flight to the trailhead (small plane, floatplane or helicopter)' }, { value: 'fromTown', label: 'Walk from town' }], hint: 'Every way visitors reach the best walking. "Drive to a trailhead" is the ordinary case (park, then a loop or out and back); tick the others when they are a real part of how it works, such as lifts that put hikers on high ridges. Gemini mentions it when it is not just a trailhead.' },
  { key: 'dayHikeRating', label: 'Day-hike rating', type: 'rating', group: 'experience', hint: '0-10. How good the place is for easy walks and day hikes, at its best time of year, on its own (the scenery the walks reach, trails, variety, signage, getting to trailheads). A place with no day hikes worth doing is 0-1.' },
  { key: 'trekRating', label: 'Trek rating', type: 'rating', group: 'experience', hint: '0-10. How good the place is for multi-day trekking, at its best time of year, on its own (the scenery the trek crosses, routes, huts or lodging, season, permits). A place with no multi-day route is 0-1.' },
  { key: 'season', label: 'Walking season', type: 'text', group: 'style', hint: 'When the trails are walkable, with the reason, e.g. "Jun-Sep; high passes hold snow until early July" or "Nov-Mar; too hot the rest of the year". A trail that needs snowshoes here and there still counts; a month only usable on skis does not.' },
  { key: 'altitude', label: 'Altitude', type: 'choice', group: 'style', options: [{ value: 'low', label: 'Low (under 5,000 ft)' }, { value: 'moderate', label: 'Moderate (5,000 to 9,000 ft)' }, { value: 'high', label: 'High (9,000 to 14,000 ft, altitude sickness possible)' }, { value: 'veryHigh', label: 'Very high (over 14,000 ft, acclimatize)' }], hint: 'The elevation of the walking that most visitors do. Pick the level of the headline routes, not the highest point in the region.' },
  { key: 'permits', label: 'Permits, fees or guide rules', type: 'text', group: 'style', wide: true, hint: 'Anything that restricts or charges for walking: timed permits, reservations, park fees, routes where a guide is required by rule. Blank when there is nothing.' },
  { key: 'crowdIndicators', label: 'Crowding evidence', type: 'multi', group: 'style', options: [{ value: 'volume', label: 'High volume' }, { value: 'recognized', label: 'Recognized problem' }, { value: 'controls', label: 'Access controls' }, { value: 'parking', label: 'Parking overflow' }, { value: 'queues', label: 'Queues or congestion' }], hint: 'An impartial count, not a feeling. Tick each one that is documented for the main hiking areas in season: HIGH VOLUME (about 2 million visits a year, or thousands a day at one site); RECOGNIZED PROBLEM (authorities or the press call it overtourism or a surge); ACCESS CONTROLS (reservations, timed entry, mandatory shuttle, toll, turnstile, road closure, introduced because of crowding); PARKING OVERFLOW (lots full early, cars along the road); QUEUES OR CONGESTION (lift lines, trail bottlenecks). 0-1 quiet, 2 moderate, 3 busy, 4 very busy, 5 crowded. Gemini must mention crowds at 5, may mention them in peak-crowd months at 4, and not at all at 3 or fewer. Put the sources in the next column.' },
  { key: 'crowdEvidence', label: 'Crowding sources', type: 'text', group: 'style', wide: true, maxLength: 900, hint: 'For each ticked indicator, the figure or fact and where it comes from, e.g. "Seceda 4,000-6,000 visitors a day (travel press); Lago di Braies car access restricted 1 Jul-15 Sep (park notice)". Blank when nothing is ticked.' },
  { key: 'hazards', label: 'Main hazards', type: 'text', group: 'style', wide: true, hint: 'The one to three things that most often hurt or surprise a walker, e.g. "Altitude sickness, river crossings, sudden storms". Plain words, no sentences. Leave out hazards that are not a real issue there.' },
  { key: 'drawSourceChecked', label: 'Source-checked', type: 'bool', group: 'draw', hint: 'Whether these entries were checked against a source.' },
];

/**
 * Notes that steer the Gemini pass for one place, edited here instead of in the fact-sheet JSON files. Blank for most places.
 * The fact-sheet builders (scripts/build-*-facts.ts) read these when they write docs/<interest>-facts.json.
 */
const GEMINI_NOTE_FACTS: FactDef[] = [
  { key: 'scopeNote', label: 'Scope note for Gemini', type: 'text', group: 'planning', wide: true, optional: true, maxLength: 1500, hint: 'What this place covers for this interest, in a few sentences: which areas are in, which are out. Sent to Gemini as the place scope.' },
  { key: 'mustMention', label: 'Must mention', type: 'list', group: 'planning', optional: true, hint: 'Things Gemini has to cover for this place, comma-separated (a named wildlife event, a famous site).' },
  { key: 'extraAvoid', label: 'Also avoid', type: 'list', group: 'planning', optional: true, hint: 'Things Gemini must leave out for this place, on top of the standing rules, comma-separated.' },
];

const FACTS_BY_INTEREST: Record<string, FactDef[]> = {
  birding: [...BIRDING_FACTS, ...GEMINI_NOTE_FACTS],
  safari: [...SAFARI_FACTS, ...GEMINI_NOTE_FACTS],
  wildlifeViewing: [...WILDLIFE_FACTS, ...GEMINI_NOTE_FACTS],
  whaleWatching: [...WHALE_FACTS, ...GEMINI_NOTE_FACTS],
  diving: [...DIVING_FACTS, ...GEMINI_NOTE_FACTS],
  surfing: [...SURFING_FACTS, ...GEMINI_NOTE_FACTS],
  hiking: [...HIKING_FACTS, ...GEMINI_NOTE_FACTS],
};

export function factDefsFor(interestKey: string): FactDef[] {
  return FACTS_BY_INTEREST[interestKey] ?? [];
}

export function visibleFactDefs(interestKey: string): FactDef[] {
  return factDefsFor(interestKey).filter((d) => !d.hidden);
}

type Parsed = { ok: true; value: InterestFactValue } | { ok: false; message: string };

/** Validate and normalize one edited cell. Empty input clears the fact (null). */
export function parseFact(def: FactDef, raw: unknown): Parsed {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return def.type === 'bool' ? { ok: true, value: false } : { ok: true, value: null };
  }
  switch (def.type) {
    case 'int': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
      if (!Number.isInteger(n) || n < 0 || n > 100000) return { ok: false, message: 'Whole number, 0 or more' };
      return { ok: true, value: n };
    }
    case 'rating': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 10) return { ok: false, message: '0 to 10' };
      return { ok: true, value: Math.round(n * 10) / 10 };
    }
    case 'text': {
      // Animal lists carry a likelihood on every entry, so they run longer than a plain note.
      const max = def.maxLength ?? (def.animals ? 700 : 400);
      const t = z.string().max(max).safeParse(Array.isArray(raw) ? raw.join(', ').trim() : String(raw).trim());
      return t.success ? { ok: true, value: t.data } : { ok: false, message: `Too long (${max} max)` };
    }
    case 'multi': {
      const allowed = optionsFor(def).map((o) => o.value);
      const picked = (Array.isArray(raw) ? raw.map(String) : String(raw).split(',')).map((x) => x.trim()).filter(Boolean);
      const bad = picked.filter((x) => !allowed.includes(x));
      if (bad.length) return { ok: false, message: `Only: ${allowed.join(', ')}` };
      const ordered = allowed.filter((a) => picked.includes(a));
      return ordered.length ? { ok: true, value: ordered } : { ok: true, value: null };
    }
    case 'draw': {
      return (DRAW_RATINGS as readonly string[]).includes(String(raw)) ? { ok: true, value: String(raw) } : { ok: false, message: 'strong, moderate or weak' };
    }
    case 'bool':
      return { ok: true, value: raw === true || raw === 'true' };
    case 'choice':
    case 'likelihood': {
      const allowed = optionsFor(def).map((o) => o.value);
      return allowed.includes(String(raw)) ? { ok: true, value: String(raw) } : { ok: false, message: `One of: ${allowed.join(', ')}` };
    }
    case 'list':
    case 'birds': {
      const list = Array.isArray(raw) ? raw.map(String) : String(raw).split(',');
      const cleaned = list.map((s) => s.trim()).filter(Boolean);
      if (cleaned.length > 12 || cleaned.some((s) => s.length > 120)) return { ok: false, message: 'Up to 12 entries, 120 characters each' };
      return { ok: true, value: cleaned };
    }
  }
}

// ---- Birding rules, shown read-only on the Birding page ---------------------
// Sourced from src/lib/scoring/anchors.ts (definition, the "ten"),
// scripts/audit-birding-model.ts and prompts/birding/v8.md. Kept here as plain
// text so the page can never disagree with itself; update this file when those
// change.

export const BIRDING_LADDER: Array<{ band: string; title: string; examples: string }> = [
  { band: '10.0', title: 'The true ceiling', examples: 'Ecuadorian Andes, Colombian Andes, Peru, Kenya, Uganda, Tanzania, Papua New Guinea' },
  { band: '8.5 – 9.5', title: 'World-class, a notch below', examples: 'Costa Rica, Peruvian Amazon; Madagascar (short list, whole endemic families)' },
  { band: '6.5 – 8.0', title: 'Major specialist destinations', examples: 'Galápagos, Hokkaido, Raja Ampat' },
  { band: '5.0 – 6.5', title: 'Solid, no world-class dimension', examples: 'Iceland, Yellowstone, Falklands (about 60 species)' },
  { band: '3.5 – 5.0', title: 'Modest or incidental', examples: 'Bagan farmland; a short-list beach destination' },
  { band: '0 – 3.0', title: 'Minimal', examples: 'A small resort island with a handful of generic species' },
];

export const BIRDING_WRITING_RULES: string[] = [
  'Birds only. Mammals, reptiles and marine life belong to other interests.',
  'Every species carries an encounter likelihood. No "birdlife is excellent."',
  '"Virtually guaranteed" only for a key target someone would detour for, or a feeder, blind or hide. Never a bird everyone sees.',
  'Overview max 550 characters, and over 450 only at peak 8.5 or higher (380 below 6, 280 below 4). Monthly max 326 (320 below 8.5, 260 below 6, 180 below 4). Aim for 55 to 70 percent of the ceiling.',
  'Endemic and rarity claims need a named source. Counts never mix in another region\'s endemics.',
  'Shared monthly blurbs only for stable conditions, and only when scores differ by under 0.5. "Host" only for transient visitors.',
  'No lodge names. Lead with the best birds. Say when a headline bird is seasonal.',
  'No self-rating words ("premier", "world-class"). No insider jargon ("lifer", "passerine", "irruptive").',
  'Bird names follow eBird / Clements capitalization and hyphenation.',
];

// ---- Safari rules, shown read-only on the Safari page ------------------------
// Sourced from prompts/safari/v1.md and the October 2026 safari audit. Update this
// file when the directive changes.

export const SAFARI_TESTS: Array<{ title: string; body: string }> = [
  { title: 'Wild animals', body: 'Free-living wildlife in a park or reserve, not a zoo, sanctuary or rehabilitation centre.' },
  { title: 'Guided game viewing', body: 'Watched from a vehicle, on foot with rangers, or from a boat or canoe, with the aim of finding animals.' },
  { title: 'Big mammals', body: 'The draw is large mammals: predators, elephants, rhinos, herds, hippos, tigers or jaguars.' },
  { title: 'Real infrastructure', body: 'Established parks or concessions, guides, tracks or boats and somewhere to stay. Not a one-off expedition.' },
];

export const SAFARI_EDGE_CASES: Array<{ case: string; ruling: string }> = [
  { case: 'Primate trekking (gorillas, chimps, lemurs, geladas)', ruling: 'Not safari. Belongs to Wildlife Viewing.' },
  { case: 'Whales, dolphins, marine life', ruling: 'Not safari. Belongs to Whale Watching or Wildlife Viewing.' },
  { case: 'Birding-only trips', ruling: 'Not safari. Birds appear only in passing, for example a nesting colony that shapes the season.' },
  { case: 'Hunting', ruling: 'Not safari.' },
  { case: '"Desert safari" (dune driving and camel rides)', ruling: 'Not safari. No wildlife draw.' },
  { case: 'North America and Europe', ruling: 'Kept out. Bear, moose and bison viewing is Wildlife Viewing.' },
  { case: 'Asian and South American parks (tiger, rhino, elephant, jaguar)', ruling: 'In, where there is a real guided park or river-safari system.' },
];

export const SAFARI_LADDER: Array<{ band: string; title: string; examples: string }> = [
  { band: '9.5 – 10', title: 'The two great ecosystems', examples: 'Serengeti–Mara migration system; Okavango–Moremi–Chobe' },
  { band: '8.5 – 9.4', title: 'Premier Big Five and predator parks', examples: 'Kruger with its private reserves; South Luangwa' },
  { band: '7.0 – 8.4', title: 'Exceptional in one dimension, or a strong second tier', examples: 'Hwange, Etosha, Ranthambore, Kaziranga, Sri Lanka, the Pantanal, Murchison Falls and Queen Elizabeth' },
  { band: '5.0 – 6.9', title: 'Restored or smaller parks, river safaris, one strong species', examples: 'Akagera, Chitwan, the Kinabatangan' },
  { band: '3.0 – 4.9', title: 'Modest game numbers or hard access', examples: 'Ethiopia\'s parks, Mole in Ghana' },
];

export const SAFARI_SCORING_WEIGHTS: Array<{ label: string; pct: number; note: string }> = [
  { label: 'Big-game density and diversity', pct: 40, note: 'How reliably a trip finds predators, elephants, rhinos and herds.' },
  { label: 'Headline spectacle', pct: 25, note: 'Migration, calving, waterhole gatherings. Lifts a place but cannot carry thin game.' },
  { label: 'Viewing quality and access', pct: 20, note: 'Open terrain, waterholes, good roads or boats, walking and night options.' },
  { label: 'Variety of ways to watch', pct: 15, note: 'Self-drive, walking, boat, night drives, private reserves.' },
];

export const SAFARI_LIKELIHOOD_SCALE: Array<{ value: string; label: string; meaning: string }> = [
  { value: 'guaranteed', label: 'Guaranteed', meaning: 'About 95% or better on a 3 to 4 day visit in the best season.' },
  { value: 'likely', label: 'Likely', meaning: 'Roughly 70 to 95%.' },
  { value: 'possible', label: 'Possible', meaning: 'Roughly 25 to 70%.' },
  { value: 'unlikely', label: 'Unlikely', meaning: 'Under about 25%.' },
  { value: 'notPresent', label: 'Not present', meaning: 'Not found there in the wild.' },
];

export const SAFARI_WRITING_RULES: string[] = [
  'Name the real park and gateway, and say how far the park is from the destination when it is over an hour away.',
  'Open with the signature experience, then name the animals a trip is built around and the one seasonal fact that decides when to go.',
  'Say honestly what a trip finds: the Big Five being present does not mean a visitor sees all five.',
  '"Virtually guaranteed" at most once per destination, only for near-certain sightings. A tiger, leopard or other elusive cat is never promised: say how it is found.',
  'No "world\'s best odds" and no daily percentages unless they appear in the verified facts.',
  'Overview max 550 characters, and over 450 only at peak 8.5 or higher (380 below 6, 280 below 4). Monthly max 326 (320 below 8.5, 260 below 6, 180 below 4).',
  'Severity must show: a month described as closed, flooded or impassable scores 0.0 to 1.0. Adjacent months that differ by 0.5 or more need text naming the seasonal driver.',
  'Monthly text is seasonal dynamics only, self-contained, and always names the park, the animals and the condition.',
  'No lodge names, no self-rating words ("premier", "world-class", "best"), no insider jargon.',
];

// ---- Wildlife Viewing rules, shown read-only on its page ---------------------
// Sourced from prompts/wildlifeViewing/v2.md (the owner's directive) and the
// October 2026 column decisions. Update when the directive changes.

export const WILDLIFE_LADDER: Array<{ band: string; title: string; examples: string }> = [
  { band: '10.0', title: 'Earth\'s absolute pinnacle experiences', examples: 'Serengeti migration crossings, Antarctic Peninsula in penguin hatching and whale feeding' },
  { band: '8.5 – 9.0', title: 'World-class megafauna hubs', examples: 'Denali, the Pantanal, South Luangwa' },
  { band: '6.5 – 7.5', title: 'Major regional wildlife destinations', examples: 'Yellowstone in spring and fall, Sierra de Andújar lynx, Churchill polar bears' },
  { band: '4.0 – 5.5', title: 'Good secondary destinations with reliable smaller fauna', examples: 'Acadia beavers and porcupines, Algarve flamingos and chameleons, Atacama vicuñas' },
  { band: '2.0 – 3.5', title: 'Modest, incidental or challenging', examples: 'Arid desert at midday, low-density scrub' },
  { band: '0.0 – 1.5', title: 'Minimal or negligible', examples: 'Amalfi cliffs, inner-city centers, Antarctica in polar midwinter' },
];

export const WILDLIFE_ANIMAL_RULES: string[] = [
  'Seven animal columns: predators, large herbivores, primates, birds, reptiles and amphibians, marine life, other. An animal can appear in more than one interest (a whale here and on Whale Watching, a penguin here and on Birding).',
  'Write each as "Animal (likelihood)", for a typical 3 to 4 day visit in the best season, using the same four words as safari: guaranteed, likely, possible, unlikely.',
  'Primates: name the standouts when there are clear ones (proboscis monkey, indri). When there are many species and no clear standout, give a count instead, for example "13 monkey species". Apes, monkeys and lemurs all count.',
  'Birds count here only when they are a wildlife draw (penguins, puffins, raptors, flamingos). Full bird lists belong to Birding.',
  'Mark an animal that is habituated or fed inside its brackets, after the likelihood: "Mountain gorilla (guaranteed, habituated)" or "Sea lion (likely, fed)". Use one word or the other, never both, and only on that animal, not on the place.',
  'Every animal named in the written text carries an explicit encounter likelihood, and a tactic where one is needed (a hide, a night walk, a guide).',
  'Scores: avoid piles of whole numbers and half-steps, and keep the full 0.1 scale.',
];

export const DIVING_TESTS: Array<{ title: string; body: string }> = [
  { title: 'Something to see underwater', body: 'Reefs, walls, wrecks, caves, kelp forests, drift dives, blue holes, springs, rifts and lakes. What counts is what a visitor sees by getting into the water, scuba or snorkeling.' },
  { title: 'Animals a visitor can get in the water with', body: 'Sharks, rays, turtles, sea lions, penguins, manatees, and wild whales or dolphins on licensed swims. An animal that can only be watched from a boat or the shore belongs to Whale Watching or Wildlife Viewing.' },
  { title: 'A way to do it within a day trip', body: 'People go for it, or trips are built around it. Cold water, a short season or no dive industry never make a place N/A on their own.' },
  { title: 'Not applicable', body: 'Nothing underwater is worth seeing within a day trip, or there is no way to get in the water to see it. The reason is stored and shown on the N/A chip.' },
];

export const DIVING_EDGE_CASES: Array<{ case: string; ruling: string }> = [
  { case: 'Cold water (Iceland, Tasmania, Svalbard)', ruling: 'In. Cold water alone never makes a place N/A; the text says drysuit or thick wetsuit once.' },
  { case: 'Captive animals (aquariums, dolphin pens)', ruling: 'Out.' },
  { case: 'Surfing, sailing, kayaking', ruling: 'Out. They belong to their own interests.' },
  { case: 'Beach swimming with nothing to see underwater', ruling: 'Out. It belongs to Beaches & Swimming.' },
  { case: 'Inland lakes, springs and rifts', ruling: 'In when worth the trip (Silfra, cenotes, blue holes). An inland place with nothing within a day trip is N/A.' },
  { case: 'Baited or fed animal encounters', ruling: 'In, and the text says so plainly.' },
  { case: 'Liveaboard-only sites', ruling: 'In. The text says "liveaboard" once where it fits and never explains the word.' },
];

export const DIVING_LADDER: Array<{ band: string; title: string; examples: string }> = [
  { band: '10', title: 'The best of the best', examples: 'Raja Ampat, the Red Sea & Nile, the Great Barrier Reef, the Galápagos, the Maldives, Komodo & Flores, Malaysian Borneo, Belize, Fiji' },
  { band: '8.5 – 9.9', title: 'Elite', examples: 'Just under a 10: Palau, Papua New Guinea, Riviera Maya. Then Cuba, the Bahamas, the Seychelles, Bali, Palawan' },
  { band: '6.5 – 8.4', title: 'A strong regional place', examples: 'Phuket & the Andaman Coast, Big Island, Turks & Caicos, French Polynesia, the Azores, Maui' },
  { band: '4.0 – 6.4', title: 'Real but modest', examples: 'The Algarve, Mauritius, Nicaragua, Andalucía, Hokkaido, the Amalfi Coast' },
  { band: '2.0 – 3.9', title: 'Low', examples: 'Glacier & Waterton Lakes, Cape Cod & the Islands, Svalbard, St Andrews & Fife' },
  { band: '0.5 – 1.9', title: 'A token or specialist option', examples: 'The Falkland Islands' },
];

export const DIVING_WRITING_RULES: string[] = [
  'Each month\'s score is how good the best in-water experience is that month, diving or snorkeling, whichever is stronger. A place that suits one better is not marked down for it.',
  'The score follows the text. Ordinary rain costs nothing. Rough seas, murky water or stinger season score a little lower. A month when trips stop scores much lower, and a month with no trips at all scores 0.0 to 0.5. Months that are genuinely the same share one score.',
  'The overview is two or three sentences: what makes the place worth it, what a visitor sees, and when it is best. Each site, animal and fact is mentioned once.',
  'A typical reef trip (warm water, day boat, ordinary certification) says nothing about boats, certification or depth. Anything unusual (liveaboard only, drysuit, baited sharks, a flooded rift) is said once, briefly. Never explain the word "liveaboard".',
  'Water only. No dive shops, resorts or operators, and nothing about the land.',
  'Name only animals a visitor meets in the water. Where a listed animal is named, use its months and odds as given, and do not oversell a rare one.',
  'Temperatures are in Fahrenheit. Depth, visibility and distances are in feet. American spelling.',
  'When sources disagree on a fact, leave the fact out or keep the wording vague. Never write "sources disagree" in a blurb.',
  'A blurb shared by several months describes a steady condition and cannot contain begins, starts, ends, clears, opens, closes, winds down or eases. State the change in the one month it happens.',
  'Overview and monthly length limits by peak score: under 4, 280 and 180 characters; under 6, 380 and 260; under 8.5, 450 and 320; 8.5 and up, 550 and 326.',
  'Only the places named under "What a 10 means" at the top of this tab may peak at 10. Everywhere else stays below it.',
  'The diving rating, snorkeling rating and "best for" columns are written with the text. Best for is "both" when the two ratings are within 1.5 of each other.',
];

/** Interests whose Rules tab has real content (the others show only the generic card). */
export const RULES_TAB_KEYS = new Set(['birding', 'safari', 'wildlifeViewing', 'diving', 'whaleWatching', 'surfing', 'hiking']);

/**
 * Columns that must never exist on any interest page. "Seasonal exceptions" and "best months" duplicate the monthly
 * text and scores written elsewhere. A test fails if any column definition uses one of these keys.
 */
export const BANNED_FACT_KEYS = ['seasonalNote', 'bestMonths'] as const;

/** Every interest's column definitions, for tests. */
export function allFactDefs(): FactDef[] {
  return Object.values(FACTS_BY_INTEREST).flat();
}

// ---- Surfing rules (from prompts/surfing/v4.md) ----------------------------------------

export const SURFING_TESTS: Array<{ title: string; body: string }> = [
  { title: 'Riding waves on a board', body: 'Surfing, longboarding, bodyboarding and stand-up paddle surfing, in the ocean, in a lake with real swell, or on a river or tidal standing wave that people actually surf. Surf lessons and rentals count as part of it.' },
  { title: 'Real', body: 'People travel to surf here, or there are surf schools, rentals, camps or named breaks that a visitor could use.' },
  { title: 'Low', body: 'Rideable waves are documented within a day trip (about two hours each way; the text says so when it is more than an hour), even if they are small, seasonal, cold, rarely working, or there is no surf industry. A coast that gets chance swell scores low and says plainly when it works.' },
  { title: 'Not applicable', body: 'No rideable waves within a day trip: landlocked with no surfed lake or river wave, a coast on a sheltered or enclosed sea or lagoon with no swell, or frozen water. The reason is stored and shown on the N/A chip.' },
];

export const SURFING_EDGE_CASES: Array<{ case: string; ruling: string }> = [
  { case: 'Windsurfing, kitesurfing, wing foiling', ruling: 'Out. They belong to Wind Sports. Where the wind is the draw and the waves are only chop, the place does not score here. A place with both writes only about riding waves.' },
  { case: 'A good beach with no rideable waves', ruling: 'Out. Sand, sunbathing and swimming belong to Beaches & Swimming.' },
  { case: 'Snorkeling and diving', ruling: 'Out. A reef matters only as the bottom a wave breaks over, which is a hazard, and nothing else.' },
  { case: 'Artificial wave pools', ruling: 'Out.' },
  { case: 'Cold water (Iceland, Scotland, Nova Scotia)', ruling: 'In. Cold water alone never makes a place N/A. The text gives the wetsuit thickness in millimeters, the way surfers say it (4/3 mm).' },
  { case: 'River, tidal and city waves (Munich, the Great Lakes)', ruling: 'In when people actually surf them.' },
  { case: 'Remote or boat-only waves (Namibia, French Polynesia)', ruling: 'In. A remote wave is still a great wave: remoteness lowers the practicalities part of the score, not the wave-quality part. The text says where it is: the nearest town, the direction and rough distance, and how you get there.' },
  { case: 'A wave that works on only a few days a year', ruling: 'In. The text says plainly how rarely it works, and that counts under swell and season in the score.' },
  { case: 'Hurricane and typhoon swell seasons', ruling: 'In. A storm season that produces the best waves is part of the season, not a penalty, unless it closes beaches or makes surfing unsafe, and then the text says so.' },
  { case: 'An old N/A flag', ruling: 'Ignored. Applicability is decided from geography and what is documented; earlier flags were wrong more than once (Tokyo, Wales and Amsterdam all have real surf scenes).' },
];

export const SURFING_SCORING_WEIGHTS: Array<{ label: string; pct: number; note: string }> = [
  { label: 'Wave quality and reputation', pct: 45, note: 'Shape, length, power and consistency of the best breaks. A wave surfers know by name sets the ceiling. Reef and point breaks that peel a long way rank above a plain beach break.' },
  { label: 'Swell and season', pct: 25, note: 'How often it works, how long the season is, how predictable. A wave that works a few days a year caps the place low.' },
  { label: 'Range', pct: 15, note: 'Breaks for different levels and conditions within reach, so a visitor always finds something.' },
  { label: 'Practicalities', pct: 15, note: 'Access, surf schools and rentals, crowds, water temperature, safety. A dangerous or heavily crowded wave counts against a place.' },
];

export const SURFING_LADDER: Array<{ band: string; title: string; examples: string }> = [
  { band: '10', title: 'A world-reference wave', examples: 'Gemini decides which places and months earn it; there is no list and no limit on months. After a run, a 10 outside the six places we expected (Bali, Maui, Lisbon, French Polynesia, Fiji, Namibia) is flagged for you to look at. Live today: Lisbon and Maui' },
  { band: '8.5 – 9.7', title: 'Elite', examples: 'Bali, Nicaragua, the Basque Country, Fiji, Vancouver Island' },
  { band: '6.5 – 8.4', title: 'A strong regional place', examples: 'Oaxaca, the Canary Islands, Cornwall, the Algarve, Costa Rica, the North Island, Sri Lanka, Sydney, Cape Town' },
  { band: '4.0 – 6.4', title: 'Real but modest, or an easy beginner place', examples: 'Puerto Rico, Big Island, Los Cabos, the Maldives, Panama, Rio de Janeiro, Okinawa, Ireland' },
  { band: '2.0 – 3.9', title: 'Low', examples: 'Tasmania, Vietnam, Phuket & the Andaman Coast, Copenhagen, Cuba, Santorini & Cyclades, Cape Cod & the Islands' },
  { band: '0.5 – 1.9', title: 'A token option', examples: 'Bavaria & Munich, Chicago' },
];

export const SURFING_WRITING_RULES: string[] = [
  'Each month\'s score is how good the surfing is that month, for whichever of two surfers the place suits better: someone learning or an experienced surfer. A place that suits one better is not marked down for it.',
  'The best wave leads. A place with one world-class wave outscores a place with a dozen gentle beginner beaches.',
  'The score follows the text. A flat month scores 0.0 to 1.0, and months that are genuinely alike share one score. Ordinary rain costs nothing.',
  'Beginner rating and advanced rating (0 to 10 each) are given at the place\'s best time of year, each judged as its own thing. The higher of the two is within 0.5 of the peak monthly score.',
  'There is no list of places that may score 10 and no limit on how many months. Gemini says what it judges to be a world-reference wave. Afterwards a check flags any 10 outside the six places we expected (Bali, Maui, Lisbon, French Polynesia, Fiji, Namibia) for you to look at, and flags four or more months at 10.',
  'The overview is two to four sentences: the wave or waves the place is known for, who it suits, and when it works. It names the break and the town. A remote or hard-to-find break is located from the nearest town, with the direction, the rough distance and how you get there. For a peak of 8.5 and up it uses more room (about 350 to 480 characters) for a second named break or a real caution.',
  'A month says what changes: the swell and its direction, the size, the wind, the water temperature and which breaks are working. A place with two coasts or two swell seasons says which one is on that month. It says what a surfer finds, never what a place lacks.',
  'Every blurb that names a break says who it suits, in a word or two (beginner-friendly, intermediate, experts only).',
  'Wave size is face height in feet: a range for an ordinary good day, and the big-day figure only when it really differs. No Hawaiian scale.',
  'Temperatures are in Fahrenheit, distances in miles or minutes of travel, wetsuit thickness in millimeters (4/3 mm). American spelling.',
  'Say plainly when a wave works only a few days a year, when it is crowded, and when it is dangerous: shallow reef, big-wave power, strong rips, boat-only access, and sharks where they are documented. Do not call a place "localism" unless it is a well-known, documented problem there.',
  '"World-class" and "legendary" are allowed. No surf schools, camps, resorts or shops by name, and nothing about windsurfing, beach quality, sunbathing, snorkeling or diving.',
  'When sources would disagree on a fact, leave it out. Never write that sources disagree.',
  'The break list and the notes sent with each place are first drafts, a pointer rather than a checklist. Where a listed break is named, its season and level are used as given.',
  'Overview and monthly length limits by peak score: under 4, 280 and 180 characters; 4 to 5.9, 380 and 260; 6 to 8.4, 450 and 320; 8.5 and up, 550 and 326. Shorter is better.',
  'A blurb shared by several months describes a steady condition and cannot contain begins, starts, ends, ceases, clears, opens, closes, winds down, tapers or eases. State the change in the one month it happens.',
];

// ---- Whale watching rules (from prompts/whaleWatching/v3.md) ----------------------------

export const WHALE_TESTS: Array<{ title: string; body: string }> = [
  { title: 'Whales, dolphins or porpoises in the wild', body: 'Watched from a boat or from shore, in the sea and coastal waters. Whales lead the score; dolphins and porpoises count, but less.' },
  { title: 'Real', body: 'Whale or dolphin watching is a reason people go, or there are regular trips built around it.' },
  { title: 'Low', body: 'Whales, dolphins or porpoises are documented within a day trip (about three hours each way; the text says so when it is more than an hour), even rarely, even with no tour industry. Any place with an ocean, sea or strait where this has ever been recorded is low, never N/A.' },
  { title: 'Not applicable', body: 'No whale, dolphin or porpoise has ever been documented within a day trip: a landlocked place with no coast in reach, or a coast or sea where it has never happened. The test is: could a traveler ever see one here or on a day trip? A missing tour industry never makes a place N/A. The reason is stored and shown on the N/A chip.' },
];

export const WHALE_EDGE_CASES: Array<{ case: string; ruling: string }> = [
  { case: 'River dolphins (Amazon, Ganges, Yangtze, Mekong and Irrawaddy river populations)', ruling: 'Out. They belong to Wildlife Viewing. A place whose only dolphins live in a river is N/A.' },
  { case: 'Seals, sea lions, manatees, whale sharks, turtles', ruling: 'Out. They belong to other interests.' },
  { case: 'Captive animals (marine parks, aquariums, dolphin pens)', ruling: 'Out.' },
  { case: 'Wild dolphin or whale swims', ruling: 'In, named as such only where legal and operator-regulated.' },
  { case: 'Dolphins or porpoises only', ruling: 'In, but the place is capped at 3.9 whatever the numbers.' },
  { case: 'Whales watched from shore (a clifftop or lookout)', ruling: 'In.' },
  { case: 'Whales hours away from the place', ruling: 'In when within a day trip. The text names the port and the distance and never presents a distant draw as nearby.' },
  { case: 'A marquee species at one site (the North Atlantic right whale at its calving ground)', ruling: 'Always addressed, with the real access situation.' },
  { case: 'Equally good all year, with chance sightings only', ruling: 'One short sentence for all twelve months and exactly one score. If there is a clear worse-weather season it is not flat: those months score a little lower and say why.' },
  { case: 'An old N/A flag', ruling: 'Ignored. Applicability is decided from geography (Malaysian Borneo, Vancouver and Wales were all N/A in error).' },
];

export const WHALE_SCORING_WEIGHTS: Array<{ label: string; pct: number; note: string }> = [
  { label: 'Whale species, reliability and variety', pct: 45, note: 'How reliably a trip finds whales, and how many kinds. One reliable species can carry a good score; several lift it further.' },
  { label: 'Encounter quality', pct: 25, note: 'Close approach, breaching, mothers and calves, feeding, how long you stay with them.' },
  { label: 'Season length and predictability', pct: 15, note: 'A long season with a known window beats a short or erratic one.' },
  { label: 'Viewing logistics and conduct', pct: 15, note: 'Regular departures, boat suitability, shore viewing, enforced operator rules. Overcrowded or unregulated viewing counts against a place.' },
];

export const WHALE_LADDER: Array<{ band: string; title: string; examples: string }> = [
  { band: '10', title: 'Whales are a headline reason people book', examples: 'Only Monterey & Big Sur, Vancouver Island, Southeast Alaska, Los Cabos, Maui, the Azores, Churchill, Cape Town, the Antarctic Peninsula and Sydney, only for their best 1 to 3 months. All ten hold a 10 today' },
  { band: '8.5 – 9.7', title: 'Elite for one or several species, reliable and well run', examples: 'Cape Cod & the Islands, Iceland, French Polynesia, Big Island, the Canary Islands, Costa Rica, the Dominican Republic, the Great Barrier Reef, Sri Lanka' },
  { band: '6.5 – 8.4', title: 'A strong regional season with a dependable species', examples: 'Nova Scotia, Vancouver & Whistler, Greenland, Madagascar, Madeira, Hokkaido, Svalbard, Okinawa' },
  { band: '4.0 – 6.4', title: 'Real but modest', examples: 'New York City, Puerto Rico, the Scottish Highlands & Isle of Skye, the Galápagos, Tokyo & Kyoto, the Lofoten Islands, Namibia' },
  { band: '2.0 – 3.9', title: 'Low: reliable dolphins or porpoises, or whales passing without regular trips', examples: 'The Algarve, the Dalmatian Coast, Wales, the Bahamas, Belize, Sicily. Dolphins and porpoises alone stop at 3.9' },
  { band: '0.5 – 1.9', title: 'Low: sightings are rare or chance', examples: 'Rome, Amsterdam, Dubai, Athens, Singapore' },
];

export const WHALE_WRITING_RULES: string[] = [
  'Use the full 0.1 scale. A 5.0 or 5.5 is no more common than a 5.1 or 5.6. A value is repeated in adjacent months only when the text is identical and the season is flat.',
  'A score matches its text. Off-season months at a seasonal place score well below the peak (usually 0.3 to 1.5), not zero, unless nothing at all is present.',
  'Severity shows: a month where weather, ice, closures or very rough seas stop trips scores at most about 40% of the peak, and a month with no trips at all scores 0.0 to 0.5.',
  'Adjacent months that differ by 0.5 or more need text naming the seasonal driver (migration, breeding, feeding, ice, weather, calm seas). Otherwise they stay within 0.4. Months with the same or near-identical text differ by less than 0.5.',
  'Weather is judged by what it does to a trip. Ordinary rain, or a wet climate where trips run normally, costs nothing. A season where trips run but conditions are clearly poor scores about 10 to 30% below a calm month, and the blurb says so in a few words. Anything that stops trips follows the severity rule.',
  'Only Monterey & Big Sur, Vancouver Island, Southeast Alaska, Los Cabos, Maui, the Azores, Churchill, Cape Town, the Antarctic Peninsula and Sydney may peak at 10, and only for their best 1 to 3 months.',
  'The overview opens with a species and why it is worth seeing here, never a scene-setter. For a low place it opens with what is actually seen, at its true level. It names the port, bay, strait or town the trips leave from (and the distance when more than an hour), the season window and the one mechanism behind it, and honest odds with the way to see it. Dolphins as a real second draw get one clause of their own. At most three sentences.',
  'Whales and dolphins are separate groups and are never blurred in one sentence.',
  'Boat trips built around whales show strong intent, so "reliable" is fine for them. Casual or incidental sightings (dolphins on any boat, whales from shore) are "regularly seen" when dependable, never "reliable". "Virtually guaranteed" is for a near-certain encounter, at most once per place, and never for dolphins that are common everywhere.',
  'No overclaiming: no "world\'s best odds" and no percentage of trips unless it is in the notes or certain. The real viewing method is named: an inflatable or a large vessel, a lookout, a day trip from a named port. A rare species no operator could find on request is cut.',
  'Monthly blurbs state seasonal dynamics only: arrivals, departures, migration legs, breeding, feeding, ice and weather that stop trips, calm-sea windows. Each is self-contained and names the species, place and condition. Never "quiet", "baseline" or what a place lacks.',
  'One blurb may serve several months only when conditions are stable and scores differ by under 0.5. A transition is stated in its one month, and shared text cannot contain begins, starts, ends, ceases, clears, opens, closes, winds down, tapers or eases.',
  'Common names are lowercase with proper nouns capitalized (humpback whale, southern right whale, harbor porpoise). Orca, never "killer whale". One name per animal throughout.',
  'No jargon ("cetacean", "operating window") and no self-rating ("world-class", "spectacular", "dramatic", "unforgettable", "stunning"). "Host" is for transient visitors only.',
  'No operator, hotel or boat names. Spell out an organization the first time with its abbreviation. Do not mention other catalog destinations by name.',
  'No captive animals, and no whale sharks, seals, manatees or turtles. Security, politics and environmental crises stay out of the text.',
  'Overview and monthly ceilings by peak score: under 4, 280 and 180 characters; 4 to 5.9, 380 and 260; 6 to 8.4, 450 and 320; 8.5 and up, 550 and 326. The overview ceiling is a hard limit. Aim for 55 to 70% of the ceiling; above 80% is padding.',
  'Months that do not change are short: one short sentence reused. Only a month with a real seasonal event earns the full length.',
];

// ---- Hiking rules (from prompts/hiking/ and the shared prompts/_shared/on-foot-core.md; owner decisions 13-14 Oct 2026) ----

export const HIKING_TESTS: Array<{ title: string; body: string }> = [
  { title: 'A trail within a day trip', body: 'A trail or route a visitor can walk within a day trip of the place (about two hours each way; the text says so when it is more than an hour). Walking tours of a city, beach strolls and scenic drives do not count.' },
  { title: 'Real', body: 'People travel to walk here, or there are named trails, a trail network or treks that a visitor could use.' },
  { title: 'Low', body: 'A real walkable trail is documented within a day trip, even if it is short, seasonal or modest, or there is no hiking industry (a city with a hill park, a coast path, a ridge above the town). The text says plainly what it is.' },
  { title: 'Not applicable', body: 'No walkable trail is documented within a day trip, so a visitor could not hike here at all. The reason is stored and shown on the N/A chip.' },
];

export const HIKING_EDGE_CASES: Array<{ case: string; ruling: string }> = [
  { case: 'Walk-up summits (Kilimanjaro, a trekking-peak walk-up)', ruling: 'In. A summit reached on foot with no technical gear is hiking.' },
  { case: 'Summits that need a rope, crampons and an ice axe on the main route', ruling: 'Out. They belong to Mountaineering.' },
  { case: 'Trail running', ruling: 'Out. It belongs to Trail Running.' },
  { case: 'Cross-country skiing and ski touring', ruling: 'Out. A month when the only way through is on skis is dead for hiking and scores 0.0.' },
  { case: 'A trail that needs snowshoes here and there, groomed winter walking trails, snowshoe routes', ruling: 'In. They count as walking, so a snowbound month at a place that has them scores low (0.1 to 1.5), not 0.0, and the text says what a walker can do.' },
  { case: 'Hut-to-hut, lodge-to-lodge and tea-house treks', ruling: 'In. Sleeping outside as a skill (permits, bears, gear) belongs to Camping & Backcountry.' },
  { case: 'Scenery and views that can only be reached on foot', ruling: 'In, and a main reason to score high: for the best walks the landscape is why people go. Hiking writes it from the walker\'s side, in a clause with a named feature.' },
  { case: 'Views anyone can reach by road, boat or a short stroll, and the landscape as a whole', ruling: 'Out. They belong to Scenic Landscapes, which says them from the landscape\'s side. Overlap is expected; the same sentence is not repeated.' },
  { case: 'The park as the destination', ruling: 'Out. It belongs to National Parks; the trails inside it are hiking.' },
  { case: 'Mountain biking, horseback riding', ruling: 'Out. They are their own interests.' },
  { case: 'City walking tours and beach strolls', ruling: 'Out. They belong to Local Culture & City Exploration and Beaches & Swimming.' },
  { case: 'A city with a real mountain or coast trail within reach (Cape Town, Hong Kong, Rio)', ruling: 'In, as real or low depending on what is there.' },
  { case: 'A remote trailhead, a required guide or a required permit', ruling: 'In. The text says how to get there, or that a guide or permit is required.' },
  { case: 'An old N/A flag', ruling: 'Ignored. Applicability is decided from geography and what is documented (Myanmar was marked N/A in error).' },
];

export const HIKING_SCORING_WEIGHTS: Array<{ label: string; pct: number; note: string }> = [
  { label: 'Scenery and drama', pct: 30, note: 'The landscape the walking passes through and the views it earns: peaks, glaciers, lakes, canyons, coasts. Scenery and views that can only be reached on foot count most.' },
  { label: 'Routes and reputation', pct: 25, note: 'The quality, variety and character of the best routes. A route hikers know by name sets the ceiling.' },
  { label: 'Season and access', pct: 20, note: 'How long the walking season is, how reliably trails are open, how much snow, monsoon, heat or closures cut it.' },
  { label: 'Practicalities', pct: 15, note: 'Getting to the trailheads, a marked trail network, huts or lodging where a route needs them, permits and guide rules, safety. A route that is hard to reach or heavily restricted counts against a place here, not in the scenery or the routes.' },
  { label: 'Range', pct: 10, note: 'Walks for different levels and lengths within reach, from easy loops to multi-day treks.' },
];

export const HIKING_LADDER: Array<{ band: string; title: string; examples: string }> = [
  { band: '10', title: 'World-reference walking', examples: 'Gemini decides which places and months earn it; there is no list and no limit on months. After a run, a 10 outside the eight places we expected (Nepal, the Dolomites, Torres del Paine, El Chaltén, Chamonix, Zermatt & the Swiss Alps, Pakistan, Ladakh) is flagged for you to look at. Live today: those eight' },
  { band: '8.5 – 9.7', title: 'Elite', examples: 'Banff & Jasper, Rocky Mountain National Park, Ethiopia, the Argentine and Chilean Lake Districts, Queenstown, Yosemite, Iceland, Madeira' },
  { band: '6.5 – 8.4', title: 'A strong regional place', examples: 'The Amalfi Coast, Cape Town, Costa Rica, Mallorca, the Canary Islands, the Big Island, the Black Forest, Ireland, the Lofoten Islands' },
  { band: '4.0 – 6.4', title: 'Real but modest, or easy walking', examples: 'Lisbon, Santorini & Cyclades, the Seychelles, Phuket & the Andaman Coast, Puerto Rico, Edinburgh, New York City' },
  { band: '2.0 – 3.9', title: 'Low', examples: 'Kruger & Sabi Sands, the Antarctic Peninsula, Charleston & Savannah, Chicago' },
  { band: '0.5 – 1.9', title: 'A token option', examples: 'New Orleans' },
];

export const HIKING_WRITING_RULES: string[] = [
  'Each month\'s score is how good the hiking is that month for the walkers the place serves: day walkers, which is nearly everywhere, or, where multi-day routes exist, trekkers. A place that suits one kind better is not marked down for it.',
  'The best walking leads. Score the best walking a visitor can actually reach, and the scenery it delivers, together. Scenery and views that can only be reached on foot count most.',
  'Reach: a place is judged by the walking within about an hour or so of it (up to about two hours for an outstanding hike, with the drive said). A city\'s best hike an hour out is in scope and named in the overview, unless another place in the catalog already owns it (Gemini is given the list of the other places).',
  'A season has a plateau and a slope. A multi-month peak or trough may share a score and a blurb. On the slopes between them every month gets its own score and its own blurb, stepping gradually, with no pairs or triples of equal scores, and never clustering on whole or half numbers. A month between a good season and a bad one is a transition month and says what changed.',
  'A dead month scores 0.0, and only a truly dead month: nothing walkable at all (flooding, a full closure, deep snow with no walking route), or only skis will do. Groomed winter walking trails and snowshoe routes count as walking, so a snowbound month at a place that has them scores 0.1 to 1.5 and says what a walker can do.',
  'Score the headline walk as the walker will find it. Ordinary rain costs nothing on a rain-hardy walk, but a walk whose reward is the view loses real points when the heights are in cloud, and every walk loses points to storm closures, snow or ice, heat, smoke, fire risk or mud, even where the gentler walks nearby do not change.',
  'A mild climate has no bad month. Where walking continues in every month, the lowest month stays within about 3 points of the peak; rain and cloud alone cost a point or two. A deeper dip needs a real cause (snow or ice closing trails, flooding, dangerous heat, a closure).',
  'Months, not seasons: for Southern Hemisphere and equatorial places the text names months ("from March to May") and never says spring, summer, autumn, fall or winter, because most readers live in the Northern Hemisphere.',
  'A place is the same all year only if its best walks really are (a low coastal path, a steady mild climate, nothing weather-dependent): one short sentence and one score, repeated. If its headline walk depends on weather, or it has any real season, the months differ.',
  'Day-hike rating and trek rating (0 to 10 each) are given at the place\'s best time of year, each judged as its own thing. The higher of the two is within 0.5 of the peak monthly score.',
  'There is no list of places that may score 10 and no limit on months. Gemini says what it judges to be world-reference walking. Afterwards a check flags any 10 outside the eight places we expected, and four or more months at 10.',
  'The overview is two to four sentences, written in one pass: each subject is handled once and finished before the next (never levadas, then a ridge hike, then levadas again). Roughly: what the hiking is known for (the network or area, then headline routes, with the town or trailhead), how you hike it when that is not the ordinary drive to a trailhead, a multi-day trek if one exists, crowds only if earned, and when it works. The limits are maximums, not targets: a top-tier place comes close to its maximum because it has more to say; a modest place stays short. Never pad.',
  'Day hiking is the default. The overview never says a place "suits day hikers" or says who a place suits. A multi-day trek is mentioned only where one exists, with its length and days.',
  'Hike or walk: it is hiking when the route needs hiking footwear (rough ground, climbing, a mountain trail, a scramble) and walking only when it is flat, paved, a boardwalk or other easy ground. A mountain or canyon route is never "walking".',
  'How you hike: most day hikes are a drive to a trailhead and a loop or out-and-back. When it works differently (cable cars, gondolas or chairlifts onto high ridges, a shuttle-only trailhead, a boat, a train, a floatplane), the overview says so in a clause, because it changes what the hike is.',
  'Naming a route: say how demanding it is in plain words, and when it is hard say what makes it hard; avoid vague level labels; trek means two or more days. A strenuous route says why in a few words (steep, long, rough ground, a scramble, exposure, altitude). No distance for a day hike unless the day is 15 miles or more; a multi-day route gets length and days. Never a length for one route and not its neighbor. One name is never turned into several routes.',
  'Which routes to name: a place famous for one main hike or circuit focuses on that hike; a place equally famous for two or three different routes names those two or three; a place generally well known for hiking, with many equally great hikes, names no specific hikes and describes what the hiking is like.',
  'The scenery is part of the story. Say what the walker sees, from the trail: the peaks, glacier, lakes, canyon or coast, and the views only walking reaches, in a clause with a named feature, not a list of adjectives. No photography tips and no drive-up viewpoints.',
  'A month says what changes: the snow line and which trails are open, monsoon or heat, daylight, whether huts and transport run, insects or smoke, and which routes are working. For a weather-dependent headline walk it says what the walker finds on it (clear mornings and afternoon cloud, storm closures, ice). It says what a walker finds, never what a place lacks.',
  'Air quality: if the air is predictably poor at a certain time of year (wildfire smoke, haze or other particulate) and that is notable and predictable for the place, the months say so. Not mentioned where it is only occasional or unusual.',
  'Crowds follow the count of documented indicators (high volume, a recognized problem, access controls, parking overflow, queues). 5 of 5: crowds must be mentioned, in the overview and the peak-crowd months. 4 of 5: may be mentioned in peak-crowd month blurbs only, never in the overview. 3 or fewer: no mention anywhere. Said as "crowded", never "overrun" or "swamped", with the specific hotspots named and the practical consequence (timed lift slots, car restrictions, a toll) when the notes name one. No quieter alternative by habit.',
  'Distances are in miles, elevations and climbing in feet, walking time in hours (days for a trek), temperatures in Fahrenheit. American spelling.',
  'Name a trail, pass, hut or viewpoint only when sure it exists and what it is. Name a hut or refuge only when the route is built around it. No tour companies, guides, outfitters or hotels.',
  'Say plainly when a route needs a permit or a guide, when it is crowded, and when it is dangerous (altitude, exposure, river crossings, avalanche slopes, bears). Do not frighten with hazards that are not a real issue there.',
  'A self-rating phrase ("world famous", "world-class") appears at most once in a place\'s whole text, only where earned, never in a month blurb and never as filler. Most places need none: the named routes and the scenery carry it. No stock opening phrase; the overview starts with what is specific to the place. The scale\'s own words ("world-reference", "elite") never appear.',
  'When sources would disagree on a fact, leave it out. Never write that sources disagree. Never state what a place lacks ("there is no ..." included).',
  'This is a travel app: never suggest staying indoors, treadmills or gyms. In a bad month, say what the trails are like (icy, flooded, closed, too hot to walk) and stop there.',
  'The levels, for Gemini\'s own judgment and never repeated as numbers or used as labels in the text: easy (under 3 miles), a middle band (a 3 to 10 mile day hike, up to about 2,000 ft of climbing), strenuous (more than 10 miles or 3,000 ft of climbing, or rough ground), trek (two or more days), expedition trek (above about 14,000 ft, or days from help).',
  'The route list and the notes sent with each place are first drafts, a pointer rather than a checklist.',
  'Overview and monthly length limits by peak score: under 4, 280 and 180 characters; 4 to 5.9, 380 and 260; 6 to 8.4, 450 and 320; 8.5 and up, 550 and 326. These are maximums, not targets: a rich place uses most of its room, a modest place does not need to, and nothing is padded.',
  'A blurb shared by several months describes a steady condition and cannot contain begins, starts, ends, ceases, clears, opens, closes, winds down, tapers, eases, arrives, returns or their other forms. State the change in the one month it happens.',
  'Overlap with the other on-foot interests is expected, and scenery counts. Nights outside are Camping & Backcountry, running is Trail Running, the park itself is National Parks, rope climbing is Mountaineering, and views anyone can reach without walking are Scenic Landscapes. Say it from the walker\'s side, and do not repeat a sentence another on-foot interest already wrote about the place.',
];
