import { DESTINATION_LOCATIONS, locationFor } from '@/lib/scoring/destinationLocations';

/**
 * The six regions a traveler can leave in or out ("Continents" in the trip settings). Each place belongs to exactly one, worked out from
 * its country (or US state) and, for the two countries that span continents, from where the place actually is.
 */
export type RegionKey = 'na' | 'csa' | 'eu' | 'af' | 'as' | 'oc';

export const REGION_KEYS: RegionKey[] = ['na', 'csa', 'eu', 'af', 'as', 'oc'];

export const REGION_LABELS: Record<RegionKey, string> = {
  na: 'North America',
  csa: 'Central & South America',
  eu: 'Europe',
  af: 'Africa',
  as: 'Asia',
  oc: 'Australia and the Pacific',
};

/** One line under each region on the continents control. */
export const REGION_SUB: Record<RegionKey, string> = {
  na: 'US, Canada, Mexico',
  csa: 'Central America, Caribbean, South America',
  eu: 'incl. Turkey (Istanbul), Georgia, western Russia',
  af: 'incl. Egypt',
  as: 'incl. the Middle East',
  oc: 'Australia, New Zealand, Pacific islands',
};

/** "How we draw the lines": shown under the map (HTML-free text with the bold words in **). */
export const REGION_RULES: string[] = [
  '**Mexico** counts as North America; **Central America and the Caribbean** count as Central & South America.',
  '**Hawaii and Alaska** count as North America (they are US states); **Puerto Rico** follows the Caribbean.',
  "**Russia** and **Turkey** are split: Russia west of the Urals and Turkey's Thrace (Istanbul) count as Europe; Siberia, the Far East and Anatolia count as Asia. A place counts by where it really is.",
  '**Armenia, Azerbaijan, Georgia and Cyprus** count as Europe. The **Middle East** counts as Asia, and **Egypt** as Africa.',
  '**Pacific islands** (Fiji, Palau, Papua New Guinea, French Polynesia) go with Australia and the Pacific.',
  '**Antarctica** only shows when all continents are on.',
];

const CODES: Record<RegionKey, string[]> = {
  na: ['CAN', 'MEX'],
  csa: ['CRI', 'GTM', 'NIC', 'PAN', 'BLZ', 'CUB', 'JAM', 'BHS', 'BRB', 'DOM', 'ABW', 'TCA', 'ARG', 'CHL', 'ECU', 'BRA', 'PER', 'COL', 'BOL', 'FLK'],
  eu: ['PRT', 'ITA', 'NLD', 'ESP', 'DEU', 'GBR', 'FRA', 'GRC', 'HRV', 'HUN', 'DNK', 'ISL', 'IRL', 'CZE', 'FIN', 'NOR', 'CHE', 'AUT', 'GEO'],
  af: ['BWA', 'ETH', 'GHA', 'KEN', 'MDG', 'MAR', 'NAM', 'RWA', 'SYC', 'TZA', 'UGA', 'ZAF', 'ZMB', 'ZWE', 'MUS', 'EGY'],
  as: ['BTN', 'KHM', 'CHN', 'IND', 'IDN', 'JPN', 'KGZ', 'LAO', 'MDV', 'MYS', 'MNG', 'MMR', 'NPL', 'PAK', 'PHL', 'SGP', 'KOR', 'LKA', 'TWN', 'VNM', 'UZB', 'JOR', 'ARE', 'THA'],
  oc: ['AUS', 'NZL', 'FJI', 'PLW', 'PNG', 'PYF'],
};
const BY_CODE = new Map<string, RegionKey>(REGION_KEYS.flatMap((k) => CODES[k].map((c) => [c, k] as [string, RegionKey])));

/** The region of a place from its country code (ISO alpha-3) or US state, and where it is. Null = no region (Antarctica, or a code not listed). */
export function regionOfPlace(loc: { type: 'country' | 'us-state'; code: string }, at: { lat: number; lon: number }): RegionKey | null {
  if (loc.type === 'us-state') return loc.code === 'PR' ? 'csa' : 'na';
  if (loc.code === 'TUR') return at.lon <= 29.05 && at.lat >= 40.6 ? 'eu' : 'as';
  if (loc.code === 'RUS') return at.lon > -100 && at.lon < 60 ? 'eu' : 'as';
  return BY_CODE.get(loc.code) ?? null;
}

/** Place id to region, for every place that has coordinates. Built on the server and sent to the screens. */
export function regionsForPlaces(coords: Record<string, { lat: number; lon: number }>): Record<string, RegionKey | null> {
  const out: Record<string, RegionKey | null> = {};
  for (const [id, at] of Object.entries(coords)) out[id] = regionOfPlace(DESTINATION_LOCATIONS[id] ?? locationFor(id), at);
  return out;
}

/** True when every region is on, which means "no preference". */
export const allRegions = (on: readonly RegionKey[]): boolean => on.length === 0 || REGION_KEYS.every((k) => on.includes(k));

/** Whether a place stays when only these regions are on. With all on, everything stays (even a place with no region, such as Antarctica). */
export function regionAllows(on: readonly RegionKey[], region: RegionKey | null | undefined): boolean {
  if (allRegions(on)) return true;
  return !!region && on.includes(region);
}
