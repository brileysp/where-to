// Turns metres in diving blurbs (depth, visibility, distance, altitude) into feet, in one strict format: "100 ft", "15-100 ft",
// "15 to 65 ft". American divers think in feet; a later display setting can convert back for metric visitors (docs/units-and-currency-plan.md).
//
// Rounding: under 10 ft to the nearest foot, under 1,000 ft to the nearest 5, above that to the nearest 10. Nearest-5 makes the
// standard dive limits come out the way divers say them: 18 m = 60 ft, 30 m = 100 ft, 40 m = 130 ft.
//
// Left alone: mm (wetsuit thickness), km, minutes, months and anything else where "m" is part of a word.

const N = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const RANGE = String.raw`(?:${N})(?:\s*(?:-|–|to|and)\s*(?:${N}))?`;
const UNIT = String.raw`(?:\s?(?:meters?|metres?)\b|\s?m(?![A-Za-z²/]))`;

export function metersToFeet(m: number): number {
  const ft = m * 3.28084;
  if (ft < 10) return Math.round(ft);
  if (ft < 1000) return Math.round(ft / 5) * 5;
  return Math.round(ft / 10) * 10;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const toNum = (s: string) => parseFloat(s.replace(/,/g, ''));

function convertRange(range: string): string {
  const m = range.match(new RegExp(String.raw`^(${N})(?:(\s*(?:-|–|to|and)\s*)(${N}))?$`));
  if (!m) return range;
  const a = fmt(metersToFeet(toNum(m[1])));
  if (!m[3]) return a;
  return `${a}${m[2]}${fmt(metersToFeet(toNum(m[3])))}`;
}

export function convertMetersToFeet(text: string): string {
  return text.replace(new RegExp(String.raw`(?<![\w.,])(${RANGE})${UNIT}`, 'g'), (_m, r) => `${convertRange(r)} ft`);
}

/** True when a metre figure is still in the text. */
export function hasMeters(text: string): boolean {
  return new RegExp(String.raw`(?<![\w.,])${RANGE}${UNIT}`).test(text);
}
