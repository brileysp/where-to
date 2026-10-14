// Flags generated text that measures a distance from a name that is part of the place itself, such as
// "boat trips from Vancouver, about two hours south of Whistler" for the place "Vancouver & Whistler",
// or "an hour and a half west of Sonoma" for "Napa & Sonoma" (those coasts are inside the place).
// Only checks places whose name joins two or more areas. A warning for a human glance: sometimes the distance is useful (Tadoussac from Quebec City), usually it is not.

const SKIP_WORDS = new Set(['national', 'park', 'parks', 'islands', 'island', 'coast', 'valley', 'lake', 'river', 'north', 'south', 'east', 'west', 'northern', 'southern', 'eastern', 'western', 'the', 'and', 'region', 'cape', 'mount', 'saint']);

export function placeNameTokens(placeName: string): string[] {
  return placeName
    .split(/[^A-Za-zÀ-ÿ'’]+/)
    .filter((w) => w.length >= 4 && !SKIP_WORDS.has(w.toLowerCase()));
}

export function ownNameDistanceIssues(placeName: string, texts: string[]): string[] {
  // Only joined places ("Vancouver & Whistler"). For a single-city place, "an hour south of Lisbon" is exactly what a reader needs.
  if (!/&|\sand\s/.test(placeName)) return [];
  const out: string[] = [];
  for (const token of placeNameTokens(placeName)) {
    const t = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dist = new RegExp(`\\b(hours?|minutes?|miles?|km|kilometers?|kilometres?)\\b[^.]{0,40}\\b(of|from)\\s+(the\\s+)?${t}\\b`, 'i');
    const compass = new RegExp(`\\b(north|south|east|west|northeast|northwest|southeast|southwest)\\s+of\\s+(the\\s+)?${t}\\b`, 'i');
    for (const text of texts) {
      const m = text.match(dist) ?? text.match(compass);
      if (m) out.push(`Measures a distance from "${token}", which is part of this place's own name: "...${m[0]}". Say where it is without measuring from the place itself.`);
    }
  }
  return [...new Set(out)];
}
