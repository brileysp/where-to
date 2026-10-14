// Units in text, both directions. Text is STORED in US units (Fahrenheit, feet, miles, mph); a visitor's home country decides what they SEE.
//
// metricToImperial(text): turns metric figures in new or old text into the stored form: 6,000m -> 19,685 ft, 75 km -> 47 miles, 100 km/h -> 60 mph,
//   22,400 km² -> 8,650 sq mi, and Celsius (via temperature.ts). A figure used as an adjective becomes hyphenated and singular: "a 400m wall" -> "a 1,310-foot wall".
// imperialToDisplay(text, units): the reverse, for a visitor whose home country uses metric. Stored text never changes.
// unitsForCountry(code): which units a country uses.
//
// Left alone in both directions: mm (wetsuit thickness), minutes, months, and any "m" or "ft" that is part of a word.

import { convertTemperaturesToF } from './temperature';
import { metersToFeet } from './length';

export type TempUnit = 'F' | 'C';
export interface Units {
  temp: TempUnit;
  /** Long distances: miles or kilometres (and mph or km/h). */
  distance: 'mi' | 'km';
  /** Heights, depths, wave sizes: feet or metres. */
  length: 'ft' | 'm';
}

const N = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const SEP = String.raw`\s*(?:-|–|to|and)\s*`;
const toNum = (s: string) => parseFloat(s.replace(/,/g, ''));
const fmt = (n: number) => n.toLocaleString('en-US');
const fmtDec = (n: number) => fmt(Math.round(n * 10) / 10);

// Words that can follow a figure without making it an adjective ("75km from Hobart", "400 km north").
const NOT_A_NOUN = new Set(['from', 'to', 'of', 'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'away', 'above', 'below', 'by', 'in', 'and', 'or', 'up', 'per', 'at', 'on', 'is', 'are', 'was', 'as', 'with', 'for', 'but', 'deep', 'high', 'long', 'wide', 'thick', 'apart', 'inland', 'offshore', 'down', 'out', 'then', 'each', 'a', 'an', 'the', 'plus', 'altitude', 'elevation', 'depth', 'when', 'where', 'while', 'so', 'if', 'it', 'that', 'which', 'before', 'after', 'over', 'under', 'between', 'around', 'near', 'off', 'across', 'along', 'behind', 'beyond', 'through', 'into', 'than', 'about', 'roughly', 'only', 'also', 'both', 'all', 'more', 'less', 'one', 'two', 'three', 'four', 'rain', 'has', 'have', 'had', 'can', 'could', 'will', 'would', 'may', 'might', 'must', 'should', 'remains', 'requires', 'needs', 'sits', 'lies', 'makes', 'were', 'be', 'been', 'being', 'does', 'did', 'depending', 'during', 'there', 'their', 'its', 'this', 'these', 'those', 'not', 'no', 'too', 'such', 'like', 'since', 'until', 'because', 'though', 'although', 'yet', 'still', 'even', 'just', 'now', 'here']);

/** True when the figure that ends at `end` is an adjective: followed by a word that is not a preposition, direction or the like. */
function isAdjective(text: string, end: number): boolean {
  const rest = text.slice(end);
  if (/^-(?:plus|long|high|deep|wide|thick)\b/i.test(rest)) return true;
  const m = /^\s+([A-Za-zÀ-ÿ'’-]+)/.exec(rest);
  if (!m) return false;
  return !NOT_A_NOUN.has(m[1].toLowerCase());
}

// ---- metric -> imperial ----------------------------------------------------------------

const kmToMiles = (km: number) => {
  const mi = km * 0.621371;
  if (mi < 10) return Math.round(mi * 10) / 10;
  if (mi < 100) return Math.round(mi);
  if (mi < 1000) return Math.round(mi / 5) * 5;
  return Math.round(mi / 10) * 10;
};
const sqKmToSqMi = (km2: number) => {
  const mi = km2 * 0.386102;
  if (mi < 10) return Math.round(mi * 10) / 10;
  if (mi < 100) return Math.round(mi);
  if (mi < 1000) return Math.round(mi / 5) * 5;
  return Math.round(mi / 10) * 10;
};
const kmhToMph = (k: number) => { const m = k * 0.621371; return m < 30 ? Math.round(m) : Math.round(m / 5) * 5; };

const METRIC = new RegExp(String.raw`(?<![\w.,])(${N})(?:(${SEP})(${N}))?\s?(km/h|kph|km²|sq\.? ?km|kilomet(?:er|re)s?|km|metres?|meters?|m)(?![A-Za-z²/\d])`, 'g');

export function metricToImperial(input: string): string {
  const text = convertTemperaturesToF(input);
  return text.replace(METRIC, (whole, a: string, sep: string | undefined, b: string | undefined, unit: string, offset: number) => {
    const u = unit.toLowerCase();
    // "m" right after a digit only: "6,000m", "75 m". A bare "m" after a space and no digit gap is covered by the regex itself.
    const adjective = isAdjective(text, offset + whole.length);
    const conv = (v: number): string => {
      if (u === 'km/h' || u === 'kph') return fmt(kmhToMph(v));
      if (u === 'km²' || u.startsWith('sq')) return fmtDec(sqKmToSqMi(v));
      if (u.startsWith('k')) return fmtDec(kmToMiles(v));
      return fmt(metersToFeet(v));
    };
    const x = conv(toNum(a));
    const y = b ? conv(toNum(b)) : null;
    const range = y ? `${x}${sep!.trim() === 'to' || sep!.trim() === 'and' ? ` ${sep!.trim()} ` : '-'}${y}` : x;
    const last = y ?? x;
    const one = last === '1';
    if (u === 'km/h' || u === 'kph') return `${range} mph`;
    if (u === 'km²' || u.startsWith('sq')) return `${range} sq mi`;
    if (u.startsWith('k')) return adjective ? `${range}-mile` : `${range} ${one ? 'mile' : 'miles'}`;
    return adjective ? `${range}-foot` : `${range} ft`;
  });
}

/** True when a metric figure (or Celsius) is still in the text. */
export function hasMetric(text: string): boolean {
  return metricToImperial(text) !== text;
}

// ---- imperial -> display ---------------------------------------------------------------

const ftToM = (ft: number) => {
  const m = ft * 0.3048;
  if (m < 3) return Math.round(m * 10) / 10;
  if (m < 100) return Math.round(m);
  if (m < 1000) return Math.round(m / 5) * 5;
  return Math.round(m / 10) * 10;
};
const miToKm = (mi: number) => {
  const km = mi * 1.609344;
  if (km < 10) return Math.round(km * 10) / 10;
  if (km < 100) return Math.round(km);
  if (km < 1000) return Math.round(km / 5) * 5;
  return Math.round(km / 10) * 10;
};
const sqMiToKm2 = (v: number) => { const k = v * 2.58999; return k < 10 ? Math.round(k * 10) / 10 : k < 100 ? Math.round(k) : k < 1000 ? Math.round(k / 5) * 5 : Math.round(k / 10) * 10; };
const mphToKmh = (v: number) => { const k = v * 1.609344; return k < 30 ? Math.round(k) : Math.round(k / 5) * 5; };
const fToC = (f: number) => Math.round(((f - 32) * 5) / 9);

const IMPERIAL = new RegExp(String.raw`(?<![\w.,])(?:(-|−)?)(${N})(?:(${SEP})(-|−)?(${N}))?(?:(\s?°\s?F\b)|(\s?(?:ft|feet|foot)\b)|(\s?(?:miles?|mi)\b)|(\s?mph\b)|(\s?sq\.? ?mi\b)|(-(?:foot|mile)\b))`, 'g');

export function imperialToDisplay(input: string, units: Units): string {
  if (units.temp === 'F' && units.length === 'ft' && units.distance === 'mi') return input;
  return input.replace(IMPERIAL, (whole, neg1: string | undefined, a: string, sep: string | undefined, neg2: string | undefined, b: string | undefined, deg: string | undefined, ft: string | undefined, mi: string | undefined, mph: string | undefined, sqmi: string | undefined, hyph: string | undefined) => {
    const sepText = sep ? (sep.trim() === 'to' || sep.trim() === 'and' ? ` ${sep.trim()} ` : '-') : '';
    const pair = (conv: (v: number) => number, f: (n: number) => string = fmtDec): string => {
      const x = conv(toNum(a) * (neg1 ? -1 : 1));
      const y = b ? conv(toNum(b) * (neg2 ? -1 : 1)) : null;
      return y === null ? f(x) : `${f(x)}${sepText}${f(y)}`;
    };
    if (deg !== undefined) return units.temp === 'C' ? `${pair(fToC, (n) => String(n))}°C` : whole;
    if (ft !== undefined) return units.length === 'm' ? `${pair(ftToM)} m` : whole;
    if (mi !== undefined) {
      if (units.distance !== 'km') return whole;
      const single = !b && toNum(a) === 1;
      void single;
      return `${pair(miToKm)} km`;
    }
    if (mph !== undefined) return units.distance === 'km' ? `${pair(mphToKmh, (n) => fmt(n))} km/h` : whole;
    if (sqmi !== undefined) return units.distance === 'km' ? `${pair(sqMiToKm2)} km²` : whole;
    if (hyph !== undefined) {
      if (/foot/.test(hyph)) return units.length === 'm' ? `${pair(ftToM)}-metre` : whole;
      return units.distance === 'km' ? `${pair(miToKm)}-kilometre` : whole;
    }
    return whole;
  });
}

// ---- countries -------------------------------------------------------------------------

/** Countries that use full US customary units. */
const IMPERIAL_COUNTRIES = new Set(['US', 'LR', 'MM']);
/** Countries that use Fahrenheit but metric for everything else. */
const F_ONLY = new Set(['BS', 'BZ', 'KY', 'PW', 'FM', 'MH']);
/** The United Kingdom: miles on the road, Celsius, metres for heights and depths. */
const MILES_AND_METRES = new Set(['GB']);

export function unitsForCountry(code: string | null | undefined): Units {
  const c = (code ?? '').toUpperCase();
  if (IMPERIAL_COUNTRIES.has(c)) return { temp: 'F', distance: 'mi', length: 'ft' };
  if (F_ONLY.has(c)) return { temp: 'F', distance: 'km', length: 'm' };
  if (MILES_AND_METRES.has(c)) return { temp: 'C', distance: 'mi', length: 'm' };
  if (!c) return { temp: 'F', distance: 'mi', length: 'ft' };
  return { temp: 'C', distance: 'km', length: 'm' };
}

export const IMPERIAL_UNITS: Units = { temp: 'F', distance: 'mi', length: 'ft' };
