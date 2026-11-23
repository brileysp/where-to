// 18 Nov 2026 (step 4 of docs/place-naming-plan.md): lets a script's place arguments be written the way people say them. "--only=myanmar", "--only=bagan" (an old id), "--only=p0113" and
// "--only=scenicLandscapes|myanmar" all find the same place; the result is always keys. A name that matches nothing stops the script, so a typo can never silently do nothing.
import { resolvePlaces } from './lookup';

export async function resolvePlaceEntries(entries: string[], flag = '--only'): Promise<string[]> {
  if (!entries.length) return [];
  const parts = entries.map((e) => { const i = e.lastIndexOf('|'); return i === -1 ? { prefix: '', name: e } : { prefix: e.slice(0, i + 1), name: e.slice(i + 1) }; });
  const { keys, unknown } = await resolvePlaces(parts.map((p) => p.name));
  if (unknown.length) { console.error(`${flag}: no place called ${unknown.map((u) => `"${u}"`).join(', ')}. Use a slug (myanmar), an old id (bagan) or a key (p0113).`); process.exit(1); }
  return parts.map((p, i) => `${p.prefix}${keys[i]}`);
}
