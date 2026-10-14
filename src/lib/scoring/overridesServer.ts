import { db } from '@/lib/db/client';
import { interestMeta, personaOverrides } from '@/lib/db/schema';
import { applyOverrides, EMPTY_OVERRIDES, type Overrides } from './overrides';

let cache: { at: number; value: Overrides } | null = null;

/** Reads the admin overrides of the interest list and personas. Kept for 10 seconds so each page load does not re-read two small tables. */
export async function loadOverrides(): Promise<Overrides> {
  if (cache && Date.now() - cache.at < 10_000) return cache.value;
  try {
    const [meta, personas] = await Promise.all([db.select().from(interestMeta), db.select().from(personaOverrides)]);
    const value: Overrides = { interests: {}, personas: {} };
    for (const r of meta) {
      const ov = { label: r.label, group: r.groupName, hidden: r.hidden, audienceTier: r.audienceTier, order: r.sortOrder };
      if (Object.values(ov).some((v) => v !== null && v !== undefined)) value.interests[r.key] = ov;
    }
    for (const p of personas) value.personas[p.personaId] = { name: p.name, icon: p.icon, blurb: p.blurb, primary: p.primary, weights: p.weights ?? {} };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    // A database hiccup must never take the page down: fall back to the built-in list.
    return cache?.value ?? EMPTY_OVERRIDES;
  }
}

/** Loads the overrides and puts them on the shared interest list and personas for this server process. */
export async function loadAndApplyOverrides(): Promise<Overrides> {
  const o = await loadOverrides();
  applyOverrides(o);
  return o;
}

/** Call after an admin save so the next read comes from the database. */
export function invalidateOverrides(): void {
  cache = null;
}
