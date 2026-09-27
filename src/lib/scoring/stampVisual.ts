import { locationFor } from './destinationLocations';

export type StampShape = 'oval' | 'circle' | 'rect' | 'hex' | 'scallop';

export interface StampVisual {
  /** ISO-3 country code, or USPS 2-letter state code for US destinations. */
  code: string;
  shape: StampShape;
  color: string;
  /** Small rotation, degrees — every real ink stamp lands a little crooked. */
  rotate: number;
  /** Overall ink intensity, 0-1 — a fresh stamp vs. one running low on ink. */
  opacity: number;
  /** feDisplacementMap scale — how far the ink strays from the clean vector edge. */
  roughness: number;
  /** Feeds the SVG noise filters so the grunge pattern is stable per design. */
  seed: number;
}

// Every US state stamp shares one boxy shape and black ink — real US entry
// stamps are plain rectangular black-ink marks, not a different design per
// state; only rotation/wear vary, and only the code text tells them apart.
const US_STATE_SHAPE: StampShape = 'rect';
const US_STATE_COLOR = '#1a1a1a';

// International stamps get real variety, but never black — a foreign entry
// stamp always carries "some degree of color" (the classic passport-ink
// look), so this shape/color pool is reserved for countries only.
const COUNTRY_SHAPES: StampShape[] = ['oval', 'circle', 'hex', 'scallop'];
const COUNTRY_COLORS = ['#2c3968', '#7a1f2b', '#1f5c4a', '#4a2c5e', '#0f3d5c', '#7a4a1f', '#1f6b7a', '#5c2e0f'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Cheap splitmix-style derivation of several independent-feeling values from one hash, without pulling in a real PRNG dependency for what's purely a visual-variety generator. */
function derive(hash: number, salt: number): number {
  let x = (hash ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  x = (x ^ (x >>> 15)) >>> 0;
  return x / 0xffffffff;
}

/**
 * One stamp design per location CODE, not per destination — every
 * destination in Italy shares one identical "Italy" stamp (same shape,
 * ink color, rotation, wear pattern), the same way a real passport shows
 * the same border-control design every time you enter that country.
 * International codes get varied shapes/colors (deterministic per code);
 * US state codes all share one shape and black ink, matching how real
 * domestic entry stamps look plainer and more uniform than foreign ones.
 */
export function stampVisualFor(destinationId: string): StampVisual {
  const { type, code } = locationFor(destinationId);
  const h = hashString(code);
  const isUsState = type === 'us-state';

  return {
    code,
    shape: isUsState ? US_STATE_SHAPE : COUNTRY_SHAPES[Math.floor(derive(h, 0) * COUNTRY_SHAPES.length) % COUNTRY_SHAPES.length],
    color: isUsState ? US_STATE_COLOR : COUNTRY_COLORS[Math.floor(derive(h, 1) * COUNTRY_COLORS.length) % COUNTRY_COLORS.length],
    rotate: -9 + derive(h, 2) * 18, // -9..9 degrees
    opacity: 0.65 + derive(h, 3) * 0.25, // 0.65..0.9
    roughness: 1.0 + derive(h, 4) * 1.4, // 1.0..2.4 — gentle enough to stay legible
    seed: Math.floor(derive(h, 5) * 1000),
  };
}
