import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { QuoteRun } from './types';

/** How the panels in the collection files were chosen, stored with every run. */
export const COLLECTION_METHOD = 'The most expensive hotel-type listings (hotels, resorts and condo-hotels; whole-home rentals removed), up to the 20 that Booking.com returns per date sorted by price; one night, two adults, US dollars, cheapest available room. A hotel is in the panel if it was among them on at least 7 of the 12 monthly dates and its price changed at least once; hotels with one fixed rate all year are left out.';

interface PartPlace { ss?: string; uni: string; n: string; idx: string; note?: string; hotels: Record<string, string> }
interface PartFile { dates: string[]; places: Record<string, PartPlace> }
interface MapEntry { placeId: string; file: string; quotedOn: string; searchTerm: string }

const parse = (s: string) => s.split('/').map((x) => (x === '-' ? null : Number(x)));

/** Reads the collection files in scripts/data (hotel-quote-panel-nov14-part*.json) and the place map, and returns one QuoteRun per place plus the index the file recorded for each date (to check against). */
export function loadCollectionRuns(dataDir = join(__dirname, '..', '..', '..', 'scripts', 'data')): Array<{ key: string; run: QuoteRun; recordedIdx: Array<number | null> }> {
  const map = JSON.parse(readFileSync(join(dataDir, 'hotel-place-map-nov15.json'), 'utf8')) as Record<string, MapEntry>;
  const cache = new Map<string, PartFile>();
  const out: Array<{ key: string; run: QuoteRun; recordedIdx: Array<number | null> }> = [];
  for (const [key, m] of Object.entries(map)) {
    if (!cache.has(m.file)) cache.set(m.file, JSON.parse(readFileSync(join(dataDir, m.file), 'utf8')) as PartFile);
    const part = cache.get(m.file)!; const p = part.places[key]; if (!p) throw new Error(`${key} is not in ${m.file}`);
    out.push({
      key, recordedIdx: parse(p.idx),
      run: {
        placeId: m.placeId, kind: 'luxury', source: 'booking.com', searchTerm: m.searchTerm ?? p.ss ?? key, quotedOn: m.quotedOn, dates: part.dates,
        listed: parse(p.uni).map((x) => x ?? 0),
        panel: Object.entries(p.hotels).map(([name, s]) => ({ name, prices: parse(s) })),
        ...(p.note ? { note: p.note } : {}),
      },
    });
  }
  return out;
}

export function collectionFileNames(dataDir = join(__dirname, '..', '..', '..', 'scripts', 'data')): string[] {
  return readdirSync(dataDir).filter((f) => /^hotel-quote-panel-nov14-part\d+\.json$/.test(f)).sort();
}
