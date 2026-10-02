import { DESTINATION_LOCATIONS, locationFor } from './destinationLocations';

/**
 * Continent, derived from each destination's existing country/US-state code
 * (`destinationLocations.ts`) rather than hand-authored per destination —
 * per `docs/final-architecture-plan.md`'s explicit preference for deriving
 * `continent` from `countryCode` ("a deterministic fact about the country,
 * not an editorial judgment call"). That doc reserves a real `continent`
 * column for the future `places` table; this file is the same kind of
 * code-level stand-in `destinationLocations.ts` already is for country
 * codes, not a new admin-editable field.
 */
export type Continent =
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania'
  | 'Antarctica';

const COUNTRY_CODE_TO_CONTINENT: Record<string, Continent> = {
  // Africa
  BWA: 'Africa', ETH: 'Africa', GHA: 'Africa', KEN: 'Africa', MDG: 'Africa',
  MAR: 'Africa', NAM: 'Africa', RWA: 'Africa', SYC: 'Africa', TZA: 'Africa',
  UGA: 'Africa', ZAF: 'Africa', ZMB: 'Africa', ZWE: 'Africa', MUS: 'Africa',
  EGY: 'Africa',
  // Asia (Middle East grouped here, matching common travel-content convention)
  BTN: 'Asia', KHM: 'Asia', CHN: 'Asia', IND: 'Asia', IDN: 'Asia', JPN: 'Asia',
  KGZ: 'Asia', LAO: 'Asia', MDV: 'Asia', MYS: 'Asia', MNG: 'Asia', MMR: 'Asia',
  NPL: 'Asia', PAK: 'Asia', PHL: 'Asia', SGP: 'Asia', KOR: 'Asia', LKA: 'Asia',
  TWN: 'Asia', VNM: 'Asia', UZB: 'Asia', JOR: 'Asia', ARE: 'Asia', THA: 'Asia',
  // Europe (Turkey and Georgia grouped here, matching common travel-content convention)
  PRT: 'Europe', ITA: 'Europe', NLD: 'Europe', ESP: 'Europe', DEU: 'Europe',
  GBR: 'Europe', FRA: 'Europe', GRC: 'Europe', HRV: 'Europe', HUN: 'Europe',
  DNK: 'Europe', ISL: 'Europe', IRL: 'Europe', CZE: 'Europe', FIN: 'Europe',
  NOR: 'Europe', CHE: 'Europe', AUT: 'Europe', GEO: 'Europe', TUR: 'Europe',
  // North America (Caribbean + Central America grouped here)
  CAN: 'North America', MEX: 'North America', CRI: 'North America',
  GTM: 'North America', NIC: 'North America', PAN: 'North America',
  BLZ: 'North America', CUB: 'North America', JAM: 'North America',
  BHS: 'North America', BRB: 'North America', DOM: 'North America',
  ABW: 'North America', TCA: 'North America',
  // South America (Falklands grouped here)
  ARG: 'South America', CHL: 'South America', ECU: 'South America',
  BRA: 'South America', PER: 'South America', COL: 'South America',
  BOL: 'South America', FLK: 'South America',
  // Oceania
  AUS: 'Oceania', NZL: 'Oceania', FJI: 'Oceania', PLW: 'Oceania',
  PNG: 'Oceania', PYF: 'Oceania',
  // Antarctica
  ATA: 'Antarctica',
};

/** Falls back to 'North America' — every current 'us-state' entry (plus PR)
 * is North America by construction, and it's the least-wrong default for
 * any future country code this table hasn't caught up with yet. */
export function getContinent(destinationId: string): Continent {
  const loc = DESTINATION_LOCATIONS[destinationId] ?? locationFor(destinationId);
  if (loc.type === 'us-state') return 'North America';
  return COUNTRY_CODE_TO_CONTINENT[loc.code] ?? 'North America';
}

/**
 * The stamps collection's own regional grouping — finer than `getContinent`,
 * and only for that one screen. `getContinent`'s "North America" folds
 * Canada, the US, Mexico, Central America, and the Caribbean all into one
 * bucket (see COUNTRY_CODE_TO_CONTINENT's comment above) — a fine
 * simplification for scoring/admin, but too coarse for a stamps page.
 * Splits that bucket four ways: Canada and the US each get their own
 * header, Mexico/Central America/Caribbean share one, and `getContinent`'s
 * separate 'South America' stays its own. Every other continent passes
 * through unchanged. REGION_DISPLAY_ORDER controls the order these four
 * (plus every other continent) render in — plain alphabetical order would
 * scatter Canada/US/Mexico.../South America apart from each other (C, M, S,
 * U), which defeats the point of splitting them out as a deliberate
 * sequence in the first place.
 */
export type StampsRegion =
  | Exclude<Continent, 'North America' | 'South America'>
  | 'Canada'
  | 'US'
  | 'Mexico, Central America and Caribbean'
  | 'South America';

export const REGION_DISPLAY_ORDER: StampsRegion[] = [
  'Canada',
  'US',
  'Mexico, Central America and Caribbean',
  'South America',
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'Oceania',
];

export function stampsRegionFor(destinationId: string): StampsRegion {
  const continent = getContinent(destinationId);
  if (continent !== 'North America') return continent;
  const loc = DESTINATION_LOCATIONS[destinationId] ?? locationFor(destinationId);
  if (loc.code === 'CAN') return 'Canada';
  if (loc.type === 'us-state') return 'US';
  return 'Mexico, Central America and Caribbean';
}
