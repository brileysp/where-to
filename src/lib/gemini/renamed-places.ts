import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface RenamedPlace { newName: string; oldNames: string[] }

/** Places renamed or re-scoped in Oct 2026 (docs/renamed-places.json: { ids: { id: "New name (was Old name)" } }). */
export function loadRenamedPlaces(root: string = join(__dirname, '..', '..', '..')): Map<string, RenamedPlace> {
  const file = join(root, 'docs', 'renamed-places.json');
  if (!existsSync(file)) return new Map();
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { ids?: Record<string, string> };
  const out = new Map<string, RenamedPlace>();
  for (const [id, text] of Object.entries(doc.ids ?? {})) {
    const m = /^(.*) \(was (.*)\)$/.exec(text);
    if (!m) continue;
    // "Angkor Wat & Siem Reap" and "Thailand - Phuket & Islands": check the distinctive parts, not generic words.
    const parts = m[2].split(/\s*(?:&|-|,)\s*/).map((x) => x.trim()).filter((x) => x.length >= 4 && !/^(thailand|national park|islands?|valley)$/i.test(x));
    out.set(id, { newName: m[1], oldNames: [...new Set([m[2], ...parts])] });
  }
  return out;
}

/** Old narrower names that survive in generated text. A warning for a human glance: the old name is fine as one item in a list for the wider place, wrong when it stands for the whole place. */
export function oldNameIssues(placeId: string, texts: string[], renamed: Map<string, RenamedPlace> = loadRenamedPlaces()): string[] {
  const r = renamed.get(placeId);
  if (!r) return [];
  const all = texts.join(' ').toLowerCase();
  const hits = r.oldNames.filter((n) => all.includes(n.toLowerCase().replace(/\s+national park$/i, '')));
  if (!hits.length) return [];
  return [`The old name ${hits.map((h) => `"${h}"`).join(', ')} appears in the text. This place is now "${r.newName}": check the old name is one item in a list for the wider place and not standing for the whole place.`];
}
