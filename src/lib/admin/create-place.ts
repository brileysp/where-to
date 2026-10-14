import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { places } from '@/lib/db/schema';
import { withAdminAudit } from '@/lib/admin/write';
import type { AdminUser } from '@/lib/admin/auth';
import { NEW_PLACE_CLIMATES, type NewPlaceClimate } from './new-place-constants';

export { NEW_PLACE_CLIMATES, slugify } from './new-place-constants';
export type { NewPlaceClimate } from './new-place-constants';

export interface NewPlaceInput {
  id: string;
  name: string;
  region: string;
  emoji?: string | null;
  climate: string;
  countryCode?: string | null;
  continent?: string | null;
  summary?: string | null;
}

/**
 * Creates an empty place. It starts retired and unpublished (not ranked, not shown to travellers), so a half-written place can never
 * appear in anyone's results; turn Primary and Published on from the Places grid once it is ready. Returns an error message, or null.
 */
export async function insertNewPlace(admin: AdminUser, input: NewPlaceInput): Promise<string | null> {
  const id = input.id.trim().toLowerCase();
  const name = input.name.trim();
  const region = input.region.trim();
  const countryCode = input.countryCode ? input.countryCode.trim().toUpperCase() : null;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return 'The id must be lowercase letters, numbers and single hyphens, like "new-orleans".';
  if (!name || !region) return 'Name and region are required.';
  if (!(NEW_PLACE_CLIMATES as readonly string[]).includes(input.climate)) return 'Pick a climate.';
  if (countryCode && !/^[A-Z]{3}$/.test(countryCode)) return 'The country code is three letters, like FRA.';
  const [existing] = await db.select({ id: places.id }).from(places).where(eq(places.id, id));
  if (existing) return `A place with the id "${id}" already exists.`;
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
    isPrimaryDestination: false,
    isPublished: false,
  };
  await withAdminAudit({ actor: admin, entityType: 'destination', entityId: id, action: 'create', before: null, after: row, write: (tx) => tx.insert(places).values(row) });
  return null;
}
