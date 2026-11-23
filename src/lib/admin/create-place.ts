import { db } from '@/lib/db/client';
import { places, placeIdentity, placeLabelHistory, placeSlugRedirects, placeIdRedirects } from '@/lib/db/schema';
import { slugify as makeSlug } from '@/lib/places/identity';
import { nextKey, uniqueSlug } from '@/lib/places/resolve';
import { clearIdentityCache } from '@/lib/places/lookup';
import { withAdminAudit } from '@/lib/admin/write';
import type { AdminUser } from '@/lib/admin/auth';
import { NEW_PLACE_CLIMATES, type NewPlaceClimate } from './new-place-constants';

import { SETTING_TAG_SLUGS, MAX_SETTING_TAGS } from '@/lib/places/setting-tags';
export { NEW_PLACE_CLIMATES, slugify } from './new-place-constants';
export type { NewPlaceClimate } from './new-place-constants';

export interface NewPlaceInput {
  name: string;
  region: string;
  emoji?: string | null;
  climate: string;
  countryCode?: string | null;
  continent?: string | null;
  summary?: string | null;
  /** What the place is like (src/lib/places/setting-tags.ts), up to four, the first primary; an idea being promoted brings its own. */
  settingTags?: string[];
}

/**
 * Creates an empty place. It starts retired and unpublished (not ranked, not shown to travellers), so a half-written place can never
 * appear in anyone's results; turn Primary and Published on from the Places grid once it is ready. The place gets the next unused KEY (p0201, p0202 ...) as its id and a
 * place_identity row (label = the name, a unique slug, a draft scope), in the same transaction (docs/place-naming-plan.md, step 4). Nobody types an id any more.
 * Returns { error } or { key, slug }.
 */
export async function insertNewPlace(admin: AdminUser, input: NewPlaceInput): Promise<{ error: string } | { key: string; slug: string }> {
  const name = input.name.trim();
  const region = input.region.trim();
  const countryCode = input.countryCode ? input.countryCode.trim().toUpperCase() : null;
  if (!name || !region) return { error: 'Name and region are required.' };
  if (!(NEW_PLACE_CLIMATES as readonly string[]).includes(input.climate)) return { error: 'Pick a climate.' };
  if (countryCode && !/^[A-Z]{3}$/.test(countryCode)) return { error: 'The country code is three letters, like FRA.' };
  const [keys, slugs, redirects, oldIds] = await Promise.all([db.select({ k: placeIdentity.key }).from(placeIdentity), db.select({ s: placeIdentity.slug }).from(placeIdentity), db.select({ s: placeSlugRedirects.slug }).from(placeSlugRedirects), db.select({ s: placeIdRedirects.oldId }).from(placeIdRedirects)]);
  const id = nextKey(keys.map((r) => r.k)); const slug = uniqueSlug(makeSlug(name), [...slugs, ...redirects, ...oldIds].map((r) => r.s));
  const row = {
    id,
    name,
    region,
    emoji: input.emoji?.trim() || '📍',
    climate: input.climate as NewPlaceClimate,
    about: '',
    baseScores: {},
    countryCode,
    continent: input.continent?.trim() || null,
    summary: input.summary?.trim() || null,
    settingTags: (input.settingTags ?? []).filter((t) => (SETTING_TAG_SLUGS as readonly string[]).includes(t)).slice(0, MAX_SETTING_TAGS),
    isPrimaryDestination: false,
    isPublished: false,
  };
  try {
    await withAdminAudit({ actor: admin, entityType: 'destination', entityId: id, action: 'create', before: null, after: row, write: async (tx) => {
      const [created] = await tx.insert(places).values(row).returning();
      await tx.insert(placeIdentity).values({ key: id, placeId: id, label: name, slug, level: 'area', scopeVersion: 1, anchors: [name], scopeStatus: 'draft', scopeNote: 'New place: level and anchors are a draft until confirmed.' });
      await tx.insert(placeLabelHistory).values({ placeKey: id, label: name, isCurrent: true, reason: 'created from the admin page' });
      return created;
    } });
  } catch (e) {
    return { error: /duplicate key|unique/i.test(String((e as Error).message)) ? 'Another place was created at the same moment; try again.' : `Could not create the place: ${(e as Error).message}` };
  }
  clearIdentityCache();
  return { key: id, slug };
}
