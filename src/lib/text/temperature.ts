// Turns every Celsius temperature in a blurb into Fahrenheit, in ONE strict format, so a later display setting can find and convert
// them reliably (see docs/units-and-currency-plan.md). Output looks like "72°F", "48-57°F", "28 to 36°F", "72 and 84°F".
//
// Handles: 22°C, 22 °C, 22C, 22 C, 22 degrees Celsius, 22 degree C, ranges joined by "-", "–", "to" or "and", negatives and
// the "−" sign, "35°C-plus", "40°C+". A Celsius figure that is already followed by the same temperature in brackets
// ("15°C (59°F)") collapses to the Fahrenheit figure alone, and so does "59°F (15°C)".

const N = String.raw`[-−]?\d+(?:\.\d+)?`;
const RANGE = String.raw`${N}(?:\s*(?:-|–|to|and)\s*${N})?`;
// A bare capital C needs a space before it and must not be followed by a letter, digit, + or - (climbing grades such as 8c+ or 8C+ stay untouched).
const C_UNIT = String.raw`(?:°\s?C(?![A-Za-z])|\s?[Dd]egrees?\s+(?:[Cc]elsius|C)\b|\s?°\s?[Cc]elsius\b|\sC(?![A-Za-z°\d+-]))`;
const F_UNIT = String.raw`(?:°\s?F\b|\s?[Dd]egrees?\s+[Ff]ahrenheit\b)`;

export const cToF = (c: number): number => Math.round((c * 9) / 5 + 32);
const num = (s: string) => parseFloat(s.replace('−', '-'));

function convertRange(range: string): string {
  const m = range.match(new RegExp(String.raw`^(${N})(?:(\s*(?:-|–|to|and)\s*)(${N}))?$`));
  if (!m) return range;
  const a = cToF(num(m[1]));
  if (!m[3]) return `${a}`;
  return `${a}${m[2]}${cToF(num(m[3]))}`;
}

export function convertTemperaturesToF(text: string): string {
  let out = text;
  // "15°C (59°F)" -> "59°F"
  out = out.replace(new RegExp(String.raw`(${RANGE})${C_UNIT}\s*\(\s*(${RANGE})\s*${F_UNIT}\s*\)`, 'g'), (_m, _c, f) => `${f.replace('−', '-')}°F`);
  // "59°F (15°C)" -> "59°F"
  out = out.replace(new RegExp(String.raw`(${RANGE})\s*${F_UNIT}\s*\(\s*${RANGE}${C_UNIT}\s*\)`, 'g'), (_m, f) => `${f.replace('−', '-')}°F`);
  // everything else
  out = out.replace(new RegExp(String.raw`(?<![\w.])(${RANGE})${C_UNIT}`, 'g'), (_m, r) => `${convertRange(r)}°F`);
  return out;
}

/** True when a Celsius figure is still in the text (used as a validator check). */
export function hasCelsius(text: string): boolean {
  return new RegExp(String.raw`(?<![\w.])${RANGE}${C_UNIT}`).test(text);
}
