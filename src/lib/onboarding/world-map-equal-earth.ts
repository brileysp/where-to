import { MAP_HEIGHT, MAP_WIDTH } from './world-map-data';

/**
 * The world map in the Equal Earth projection (Šavrič, Patterson and Jenny, 2018), so a country keeps its true share of the map and Greenland no longer looks as big as Africa.
 * The map outlines in world-map-data.ts are stored in a plain longitude/latitude grid (720 by 284, longitude -180 to 180, latitude 84 to -58); this reads them back to
 * longitude and latitude and draws them again in Equal Earth. Pure functions, so they are easy to test.
 */
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const SQRT3_2 = Math.sqrt(3) / 2;
/** The outlines are stored for latitude 84 to -58; the map shows 88 to -72 so Greenland and Tierra del Fuego are not jammed against the edges. */
const DATA_TOP = 84;
const DATA_BOTTOM = -58;
const TOP = 88;
const BOTTOM = -72;
/**
 * The left edge of the map, in Equal Earth units. The map's own left edge would be -2.66 (180 degrees west on the equator), but nothing lies west of Hawaii
 * (Kauai, -2.32) except a sliver of Fiji, so the edge is pulled in to leave Hawaii a little room and let the continents stretch (owner, 22 Nov 2026).
 */
const XMIN = -2.39;

/** Equal Earth coordinates for a longitude and latitude in degrees (x to the right, y up), before any scaling. */
export function equalEarth(lonDeg: number, latDeg: number): { x: number; y: number } {
  const lam = (lonDeg * Math.PI) / 180;
  const phi = (latDeg * Math.PI) / 180;
  const t = Math.asin(SQRT3_2 * Math.sin(phi));
  const t2 = t * t;
  const t6 = t2 * t2 * t2;
  const x = (2 * Math.sqrt(3) * lam * Math.cos(t)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return { x, y };
}

export interface EqualEarthMap {
  width: number;
  height: number;
  /** Where a longitude and latitude land on this map, in the same units as `width` and `height` (y down). */
  project: (lon: number, lat: number) => [number, number];
  /** The outlines, redrawn. */
  paths: Record<string, string>;
}

const XMAX = equalEarth(180, 0).x;
const YTOP = equalEarth(0, TOP).y;
const YBOT = equalEarth(0, BOTTOM).y;

/** Builds the map at a given width. Points outside the 88 to -72 latitude band, or west of Hawaii, are held to the edge. */
export function buildEqualEarth(grid: Record<string, string>, width = 720): EqualEarthMap {
  const s = width / (XMAX - XMIN);
  const height = (YTOP - YBOT) * s;
  const raw = (lon: number, lat: number): [number, number] => {
    const p = equalEarth(lon, Math.max(BOTTOM, Math.min(TOP, lat)));
    return [(p.x - XMIN) * s, (YTOP - p.y) * s];
  };
  const project = (lon: number, lat: number): [number, number] => {
    const [x, y] = raw(lon, lat);
    return [round1(Math.max(0, Math.min(width, x))), round1(y)];
  };
  const paths: Record<string, string> = {};
  for (const [k, d] of Object.entries(grid)) {
    const parts: string[] = [];
    for (const sub of d.split('M').slice(1)) {
      const pts = Array.from(sub.matchAll(/([\d.]+),([\d.]+)/g)).map((m) => {
        const lon = (Number(m[1]) / MAP_WIDTH) * 360 - 180;
        const lat = DATA_TOP - (Number(m[2]) / MAP_HEIGHT) * (DATA_TOP - DATA_BOTTOM);
        return [lon, lat] as const;
      });
      // A piece that lies entirely in the cut-off strip (Wrangel Island) is dropped.
      if (pts.every(([lon, lat]) => raw(lon, lat)[0] <= 0)) continue;
      parts.push(`M${pts.map(([lon, lat]) => project(lon, lat).join(',')).join('L')}Z`);
    }
    paths[k] = parts.join('');
  }
  return { width, height: round1(height), project, paths };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
