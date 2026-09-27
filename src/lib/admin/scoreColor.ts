/**
 * Sequential white → light-green → green, not the app's own diverging
 * red/yellow/green month-bar scale — a full-saturation red on every
 * middling cell reads as "wrong" everywhere at once across a whole grid of
 * scores, which is too loud for a dense admin table meant to be scanned
 * quickly. 0 renders as no fill at all (the table's own background) rather
 * than "white," so a plainly blank destination reads as visually quiet,
 * not as the coldest point on a scale.
 */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}
function mixHex(h1: string, h2: string, t: number): string {
  const a = hexToRgb(h1);
  const b = hexToRgb(h2);
  return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

export function scoreColor(v: number | null | undefined): string | null {
  if (v === null || v === undefined || v === 0) return null;
  const WHITE = '#ffffff';
  const LIGHT_GREEN = '#bfe0c8';
  const GREEN = '#3a7d4f';
  return v <= 5 ? mixHex(WHITE, LIGHT_GREEN, v / 5) : mixHex(LIGHT_GREEN, GREEN, (v - 5) / 5);
}
