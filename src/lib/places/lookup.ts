// 18 Nov 2026 (step 4 of docs/place-naming-plan.md): the one place that reads the place identity tables. Everything that needs a place's label, or has to turn a typed slug / old id into a key,
// goes through here, so no screen, report or script has to know how a place was once named. Server and scripts only (it reads the database); pure rules are in resolve.ts.
import { db } from '@/lib/db/client';
import { placeIdentity, placeSlugRedirects, placeIdRedirects } from '@/lib/db/schema';
import { resolveAll, resolveFrom, type IdentityTables, type Resolved } from './resolve';

type Executor = Pick<typeof db, 'select'>;
let cache: { at: number; t: IdentityTables } | null = null;
const TTL_MS = 60_000;

export async function loadIdentityTables(ex: Executor = db, fresh = false): Promise<IdentityTables> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.t;
  const [identity, slugRedirects, idRedirects] = await Promise.all([
    ex.select({ key: placeIdentity.key, label: placeIdentity.label, slug: placeIdentity.slug }).from(placeIdentity),
    ex.select({ slug: placeSlugRedirects.slug, placeKey: placeSlugRedirects.placeKey }).from(placeSlugRedirects),
    ex.select({ oldId: placeIdRedirects.oldId, placeKey: placeIdRedirects.placeKey }).from(placeIdRedirects),
  ]);
  const t = { identity, slugRedirects, idRedirects }; cache = { at: Date.now(), t }; return t;
}
/** Forget the cached tables (after a label or slug edit, and in tests). */
export function clearIdentityCache(): void { cache = null; }

/** The place for whatever was typed: a key, a slug, an old slug or an old id. Null when nothing matches. */
export async function resolvePlace(input: string): Promise<Resolved | null> { return resolveFrom(await loadIdentityTables(), input); }

/** Keys for a list of typed places; `unknown` lists entries that matched nothing (a script should stop on any). */
export async function resolvePlaces(inputs: string[]): Promise<{ keys: string[]; unknown: string[] }> { return resolveAll(await loadIdentityTables(), inputs); }

/** key -> label, the only thing a report or page should print about a place. */
export async function labelsByKey(): Promise<Map<string, string>> { return new Map((await loadIdentityTables()).identity.map((r) => [r.key, r.label])); }
export async function labelOf(key: string): Promise<string> { return (await labelsByKey()).get(key) ?? key; }
