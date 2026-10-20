import { AIRPORT_ROWS } from './airports-data';
import { getOnboardingSettings } from './settings';

/** The home city or airport picker's search (docs/onboarding-v2/SPEC.md 5.4) and the flight-hours estimate. */

export interface Airport {
  code: string;
  city: string;
  /** Region, with the airport's own name in brackets when the city has more than one ("England (Heathrow)"). */
  region: string;
  lat: number;
  lon: number;
}

/** Names that tell apart the airports of a city that has several. */
const AIRPORT_NAMES: Record<string, string> = {
  LHR: 'Heathrow', LGW: 'Gatwick', STN: 'Stansted', LTN: 'Luton', LCY: 'City',
  ORD: "O'Hare", MDW: 'Midway', JFK: 'Kennedy', LGA: 'LaGuardia', IAD: 'Dulles', DCA: 'Reagan', IAH: 'Bush', HOU: 'Hobby',
  EZE: 'Ezeiza', AEP: 'Aeroparque', CDG: 'Charles de Gaulle', ORY: 'Orly', NRT: 'Narita', HND: 'Haneda', KIX: 'Kansai', ITM: 'Itami',
  ICN: 'Incheon', GMP: 'Gimpo', PEK: 'Capital', PKX: 'Daxing', PVG: 'Pudong', SHA: 'Hongqiao', BKK: 'Suvarnabhumi', DMK: 'Don Mueang',
  IST: 'Istanbul Airport', SAW: 'Sabiha Gokcen',
};

export const AIRPORTS: Airport[] = AIRPORT_ROWS.map(([code, city, region, lat, lon]) => ({
  code,
  city,
  region: AIRPORT_NAMES[code] ? `${region} (${AIRPORT_NAMES[code]})` : region,
  lat,
  lon,
}));

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));
export const airportByCode = (code: string | null | undefined): Airport | undefined => (code ? BY_CODE.get(code.toUpperCase()) : undefined);

const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);

/** How well an airport matches what was typed: 0 city starts with it, 1 code starts with it, 2 a word of the city starts with it, 3 the region contains it, 9 no match. */
function rank(a: Airport, q: string): number {
  const city = a.city.toLowerCase();
  if (city.startsWith(q)) return 0;
  if (a.code.toLowerCase().startsWith(q)) return 1;
  if (words(a.city).some((w) => w.startsWith(q))) return 2;
  if (q.length > 2 && a.region.toLowerCase().includes(q)) return 3;
  return 9;
}

/** Up to six matches, best first (ties keep list order). Nothing until two letters have been typed. */
export function searchAirports(text: string): Airport[] {
  const s = getOnboardingSettings();
  const q = text.trim().toLowerCase();
  if (q.length < s.airportMinLetters) return [];
  return AIRPORTS.map((a, i) => ({ a, r: rank(a, q), i }))
    .filter((x) => x.r < 9)
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .slice(0, s.airportMatches)
    .map((x) => x.a);
}

const EARTH_MILES = 3958.8;

/** Straight-line distance in miles between two points. */
export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rough flying time from the straight-line distance: 500 mph in the air plus half an hour on the ground, to the nearest half hour. */
export function estimateFlightHours(miles: number): number {
  return Math.max(1, Math.round((miles / 500 + 0.5) * 2) / 2);
}
