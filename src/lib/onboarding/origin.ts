/**
 * Where a traveler lives, for estimating flights: a country, then (for the United States and Canada only) a state or province, then optionally
 * an airport. Without an airport the flights are estimated from the middle of the state, from the province's main city, or from the country's
 * main city. Coordinates are approximate, which is plenty for hours of flying.
 */
import { airportByCode, AIRPORTS, type Airport } from './airports';

export interface Origin {
  lat: number;
  lon: number;
  label: string;
}

export type SubRow = readonly [code: string, name: string, lat: number, lon: number];
export type ProvinceRow = readonly [code: string, name: string, city: string, lat: number, lon: number, airportRegion: string];
export type CountryRow = readonly [code: string, name: string, lat: number, lon: number];

export const US_STATES: readonly SubRow[] = [
  ['AL', 'Alabama', 32.8, -86.8],
  ['AK', 'Alaska', 64.2, -152.0],
  ['AZ', 'Arizona', 34.3, -111.7],
  ['AR', 'Arkansas', 34.9, -92.4],
  ['CA', 'California', 37.2, -119.5],
  ['CO', 'Colorado', 39.0, -105.5],
  ['CT', 'Connecticut', 41.6, -72.7],
  ['DE', 'Delaware', 39.0, -75.5],
  ['DC', 'District of Columbia', 38.9, -77.0],
  ['FL', 'Florida', 28.6, -82.4],
  ['GA', 'Georgia', 32.7, -83.4],
  ['HI', 'Hawaii', 20.8, -156.3],
  ['ID', 'Idaho', 44.4, -114.6],
  ['IL', 'Illinois', 40.0, -89.2],
  ['IN', 'Indiana', 39.9, -86.3],
  ['IA', 'Iowa', 42.1, -93.5],
  ['KS', 'Kansas', 38.5, -98.4],
  ['KY', 'Kentucky', 37.5, -85.3],
  ['LA', 'Louisiana', 31.1, -92.0],
  ['ME', 'Maine', 45.4, -69.2],
  ['MD', 'Maryland', 39.0, -76.8],
  ['MA', 'Massachusetts', 42.3, -71.8],
  ['MI', 'Michigan', 44.3, -85.4],
  ['MN', 'Minnesota', 46.3, -94.3],
  ['MS', 'Mississippi', 32.7, -89.7],
  ['MO', 'Missouri', 38.4, -92.5],
  ['MT', 'Montana', 47.0, -109.6],
  ['NE', 'Nebraska', 41.5, -99.8],
  ['NV', 'Nevada', 39.3, -116.6],
  ['NH', 'New Hampshire', 43.7, -71.6],
  ['NJ', 'New Jersey', 40.1, -74.7],
  ['NM', 'New Mexico', 34.4, -106.1],
  ['NY', 'New York', 42.9, -75.5],
  ['NC', 'North Carolina', 35.6, -79.4],
  ['ND', 'North Dakota', 47.5, -100.5],
  ['OH', 'Ohio', 40.4, -82.8],
  ['OK', 'Oklahoma', 35.6, -97.5],
  ['OR', 'Oregon', 43.9, -120.6],
  ['PA', 'Pennsylvania', 40.9, -77.8],
  ['RI', 'Rhode Island', 41.7, -71.5],
  ['SC', 'South Carolina', 33.9, -80.9],
  ['SD', 'South Dakota', 44.4, -100.2],
  ['TN', 'Tennessee', 35.8, -86.3],
  ['TX', 'Texas', 31.5, -99.3],
  ['UT', 'Utah', 39.3, -111.7],
  ['VT', 'Vermont', 44.1, -72.7],
  ['VA', 'Virginia', 37.5, -78.8],
  ['WA', 'Washington', 47.4, -120.5],
  ['WV', 'West Virginia', 38.6, -80.6],
  ['WI', 'Wisconsin', 44.6, -89.9],
  ['WY', 'Wyoming', 43.0, -107.5],
];

/** Canada: the main city of each province or territory, and the airport list's own name for its region ('' = no listed airports). */
export const CA_PROVINCES: readonly ProvinceRow[] = [
  ['AB', 'Alberta', 'Calgary', 51.0, -114.1, 'Alberta, Canada'],
  ['BC', 'British Columbia', 'Vancouver', 49.3, -123.1, 'British Columbia, Canada'],
  ['MB', 'Manitoba', 'Winnipeg', 49.9, -97.1, 'Prairies, Canada'],
  ['NB', 'New Brunswick', 'Moncton', 46.1, -64.8, 'Atlantic Canada'],
  ['NL', 'Newfoundland and Labrador', "St. John's", 47.6, -52.7, 'Atlantic Canada'],
  ['NS', 'Nova Scotia', 'Halifax', 44.6, -63.6, 'Atlantic Canada'],
  ['NT', 'Northwest Territories', 'Yellowknife', 62.5, -114.4, ''],
  ['NU', 'Nunavut', 'Iqaluit', 63.7, -68.5, ''],
  ['ON', 'Ontario', 'Toronto', 43.7, -79.4, 'Ontario, Canada'],
  ['PE', 'Prince Edward Island', 'Charlottetown', 46.2, -63.1, 'Atlantic Canada'],
  ['QC', 'Quebec', 'Montreal', 45.5, -73.6, 'Quebec, Canada'],
  ['SK', 'Saskatchewan', 'Saskatoon', 52.1, -106.7, 'Prairies, Canada'],
  ['YT', 'Yukon', 'Whitehorse', 60.7, -135.1, ''],
];

/** The countries a traveler can pick as home, each with its main city. Others use the airport search. */
export const HOME_COUNTRIES: readonly CountryRow[] = [
  ['US', 'United States', 39.8, -98.6],
  ['CA', 'Canada', 45.4, -75.7],
  ['MX', 'Mexico', 19.4, -99.1],
  ['GB', 'United Kingdom', 51.5, -0.1],
  ['IE', 'Ireland', 53.3, -6.3],
  ['FR', 'France', 48.9, 2.4],
  ['DE', 'Germany', 50.1, 8.7],
  ['ES', 'Spain', 40.4, -3.7],
  ['IT', 'Italy', 41.9, 12.5],
  ['NL', 'Netherlands', 52.4, 4.9],
  ['CH', 'Switzerland', 47.4, 8.5],
  ['SE', 'Sweden', 59.3, 18.1],
  ['NO', 'Norway', 59.9, 10.8],
  ['DK', 'Denmark', 55.7, 12.6],
  ['PL', 'Poland', 52.2, 21.0],
  ['PT', 'Portugal', 38.7, -9.1],
  ['AU', 'Australia', -33.9, 151.2],
  ['NZ', 'New Zealand', -36.8, 174.8],
  ['JP', 'Japan', 35.7, 139.7],
  ['KR', 'South Korea', 37.6, 127.0],
  ['CN', 'China', 31.2, 121.5],
  ['SG', 'Singapore', 1.3, 103.8],
  ['IN', 'India', 19.1, 72.9],
  ['AE', 'United Arab Emirates', 25.2, 55.3],
  ['IL', 'Israel', 32.1, 34.8],
  ['TR', 'Turkey', 41.0, 29.0],
  ['ZA', 'South Africa', -26.2, 28.0],
  ['EG', 'Egypt', 30.0, 31.2],
  ['BR', 'Brazil', -23.5, -46.6],
  ['AR', 'Argentina', -34.6, -58.4],
  ['CL', 'Chile', -33.4, -70.7],
  ['CO', 'Colombia', 4.7, -74.1],
  ['PH', 'Philippines', 14.6, 121.0],
  ['TH', 'Thailand', 13.8, 100.5],
  ['MY', 'Malaysia', 3.1, 101.7],
  ['ID', 'Indonesia', -6.2, 106.8],
];

export const countryName = (code: string | null | undefined): string | undefined => HOME_COUNTRIES.find((c) => c[0] === code)?.[1];

/** True for the countries that ask a second question. */
export const hasSubStep = (country: string | null | undefined): boolean => country === 'US' || country === 'CA';

export function subLabel(country: string | null | undefined): string {
  return country === 'CA' ? 'Province or territory' : 'State';
}

/** The choices for the second question: [code, name]. */
export function subChoices(country: string | null | undefined): Array<[string, string]> {
  if (country === 'US') return US_STATES.map((s) => [s[0], s[1]]);
  if (country === 'CA') return CA_PROVINCES.map((p) => [p[0], p[1]]);
  return [];
}

/**
 * The point flights are measured from: the airport if one is chosen, otherwise the state, province or country. Null when there is nothing to
 * go on yet (a country that needs a state or province but has none).
 */
export function resolveOrigin(h: { airport?: string | null; country?: string | null; sub?: string | null }): Origin | null {
  const a = airportByCode(h.airport);
  if (a) return { lat: a.lat, lon: a.lon, label: `${a.city} (${a.code})` };
  if (h.country === 'US') {
    const s = US_STATES.find((x) => x[0] === h.sub);
    return s ? { lat: s[2], lon: s[3], label: s[1] } : null;
  }
  if (h.country === 'CA') {
    const p = CA_PROVINCES.find((x) => x[0] === h.sub);
    return p ? { lat: p[3], lon: p[4], label: `${p[2]}, ${p[1]}` } : null;
  }
  const c = HOME_COUNTRIES.find((x) => x[0] === h.country);
  return c ? { lat: c[2], lon: c[3], label: c[1] } : null;
}

/** The airports to offer after a state or province is chosen (may be none). */
export function airportsFor(country: string | null | undefined, sub: string | null | undefined): Airport[] {
  if (country === 'US') {
    const name = US_STATES.find((x) => x[0] === sub)?.[1];
    return name ? AIRPORTS.filter((a) => a.region === `${name}, US` || a.region.startsWith(`${name}, US (`)) : [];
  }
  if (country === 'CA') {
    const region = CA_PROVINCES.find((x) => x[0] === sub)?.[5];
    return region ? AIRPORTS.filter((a) => a.region === region || a.region.startsWith(`${region} (`)) : [];
  }
  return [];
}

/** A short line for the traveler's home: "Chicago (ORD)", "Illinois, US", "Toronto, Ontario, Canada", "Japan" or "Not set". */
export function originLabel(h: { airport?: string | null; country?: string | null; sub?: string | null }): string {
  const o = resolveOrigin(h);
  if (!o) return 'Not set';
  if (airportByCode(h.airport)) return o.label;
  if (h.country === 'US') return `${o.label}, US`;
  if (h.country === 'CA') return `${o.label}, Canada`;
  return o.label;
}
