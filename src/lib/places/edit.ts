// 18 Nov 2026 (step 5 of docs/place-naming-plan.md): the three things an admin can change about a place's identity, each in one transaction with an audit entry: its LABEL (and, if asked, its
// web address), its SLUG, and its SCOPE. The key never changes. A rename writes the label history automatically (the old label stays on record, and later becomes a banned word in texts);
// a retired slug keeps redirecting; a widened or narrowed scope adds 1 to the scope version so data made under the old scope can be listed. Server only.
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { places, placeIdentity, placeLabelHistory, placeSlugRedirects, placeIdRedirects } from '@/lib/db/schema';
import { withAdminAudit } from '@/lib/admin/write';
import type { AdminUser } from '@/lib/admin/auth';
import { SCOPE_LEVELS, dateNote, isValidSlug, parseAnchors, slugify, type ScopeLevel } from './identity';
import { uniqueSlug } from './resolve';
import { clearIdentityCache } from './lookup';

export type EditResult = { ok: true; slug: string; message: string } | { ok: false; error: string };

async function load(key: string) {
  const [i] = await db.select().from(placeIdentity).where(eq(placeIdentity.key, key));
  return i ?? null;
}
/** Every address a place could be reached by except the ones that belong to `key` itself. */
async function takenSlugs(key: string): Promise<Set<string>> {
  const [live, red, ids] = await Promise.all([
    db.select({ s: placeIdentity.slug }).from(placeIdentity).where(ne(placeIdentity.key, key)),
    db.select({ s: placeSlugRedirects.slug }).from(placeSlugRedirects).where(ne(placeSlugRedirects.placeKey, key)),
    db.select({ s: placeIdRedirects.oldId }).from(placeIdRedirects).where(ne(placeIdRedirects.placeKey, key)),
  ]);
  return new Set([...live, ...red, ...ids].map((r) => r.s));
}

/** Renames a place. `alsoSlug` moves the web address to match; the old address keeps redirecting. */
export async function changeLabel(admin: AdminUser, key: string, newLabel: string, opts: { reason?: string; alsoSlug?: boolean } = {}): Promise<EditResult> {
  const label = newLabel.trim().replace(/\s+/g, ' ');
  if (!label) return { ok: false, error: 'The name cannot be empty.' };
  if (label.length > 120) return { ok: false, error: 'The name is too long (120 characters at most).' };
  const cur = await load(key); if (!cur) return { ok: false, error: 'No such place.' };
  if (label === cur.label) return { ok: false, error: 'That is already the name.' };
  const dupe = (await db.select({ k: placeIdentity.key, l: placeIdentity.label }).from(placeIdentity).where(ne(placeIdentity.key, key))).find((r) => r.l.toLowerCase() === label.toLowerCase());
  if (dupe) return { ok: false, error: `Another place is already called "${dupe.l}".` };
  const [placeRow] = await db.select().from(places).where(eq(places.id, key)); if (!placeRow) return { ok: false, error: 'The place row is missing.' };
  const newSlug = opts.alsoSlug ? uniqueSlug(slugify(label), await takenSlugs(key)) : cur.slug; // its own retired addresses are not 'taken': a place can take one back
  const slugChanges = newSlug !== cur.slug;
  const before = placeRow; const after = { ...placeRow, name: label };
  await withAdminAudit({ actor: admin, entityType: 'destination', entityId: key, action: 'update', before, after, write: async (tx) => {
    await tx.update(places).set({ name: label, updatedAt: new Date() }).where(eq(places.id, key));
    await tx.update(placeIdentity).set({ label, slug: newSlug, updatedAt: new Date() }).where(eq(placeIdentity.key, key));
    await tx.update(placeLabelHistory).set({ isCurrent: false, retiredNote: dateNote(new Date()) }).where(and(eq(placeLabelHistory.placeKey, key), eq(placeLabelHistory.isCurrent, true)));
    await tx.insert(placeLabelHistory).values({ placeKey: key, label, isCurrent: true, reason: opts.reason?.trim() || 'renamed from the admin page' });
    if (slugChanges) {
      await tx.delete(placeSlugRedirects).where(eq(placeSlugRedirects.slug, newSlug)); // reclaiming one of its own retired addresses
      await tx.insert(placeSlugRedirects).values({ slug: cur.slug, placeKey: key, kind: 'old_slug' }).onConflictDoNothing();
    }
  } });
  clearIdentityCache();
  return { ok: true, slug: newSlug, message: `Renamed to "${label}"${slugChanges ? ` and the address is now ${newSlug}` : ''}. The old name "${cur.label}" is kept in the history.` };
}

/** Changes only the web address (slug). The old address keeps redirecting. */
export async function changeSlug(admin: AdminUser, key: string, newSlug: string): Promise<EditResult> {
  const slug = newSlug.trim().toLowerCase();
  if (!isValidSlug(slug)) return { ok: false, error: 'An address is lowercase letters and numbers joined by single hyphens, like new-orleans.' };
  const cur = await load(key); if (!cur) return { ok: false, error: 'No such place.' };
  if (slug === cur.slug) return { ok: false, error: 'That is already the address.' };
  if ((await takenSlugs(key)).has(slug)) return { ok: false, error: `The address "${slug}" belongs to another place (or to one of its old addresses).` };
  await withAdminAudit({ actor: admin, entityType: 'place_identity', entityId: key, action: 'update', skipPlaceCache: true, before: { slug: cur.slug }, after: { slug }, write: async (tx) => {
    await tx.delete(placeSlugRedirects).where(eq(placeSlugRedirects.slug, slug));
    await tx.update(placeIdentity).set({ slug, updatedAt: new Date() }).where(eq(placeIdentity.key, key));
    await tx.insert(placeSlugRedirects).values({ slug: cur.slug, placeKey: key, kind: 'old_slug' }).onConflictDoNothing();
  } });
  clearIdentityCache();
  return { ok: true, slug, message: `The address is now ${slug}; ${cur.slug} still redirects to it.` };
}

export interface ScopeInput { level: string; anchorsText: string; note: string; /** The place now covers a different area (widened or narrowed): adds 1 to the scope version. */ changesCoverage: boolean; confirm: boolean }

/** Saves the scope: level, the named places it covers, a note. Ticking changesCoverage adds 1 to the scope version, so data made under the old scope is listed as made for a different one. */
export async function changeScope(admin: AdminUser, key: string, input: ScopeInput): Promise<EditResult> {
  const cur = await load(key); if (!cur) return { ok: false, error: 'No such place.' };
  if (!(SCOPE_LEVELS as readonly string[]).includes(input.level)) return { ok: false, error: 'Pick a level.' };
  const anchors = parseAnchors(input.anchorsText); if (!anchors.length) return { ok: false, error: 'Give at least one place the scope covers.' };
  const note = input.note.trim(); const version = cur.scopeVersion + (input.changesCoverage ? 1 : 0); const status = input.confirm ? 'confirmed' : 'draft';
  const before = { level: cur.level, anchors: cur.anchors, scopeNote: cur.scopeNote, scopeVersion: cur.scopeVersion, scopeStatus: cur.scopeStatus };
  const after = { level: input.level as ScopeLevel, anchors, scopeNote: note, scopeVersion: version, scopeStatus: status };
  await withAdminAudit({ actor: admin, entityType: 'place_identity', entityId: key, action: 'update', skipPlaceCache: true, before, after, write: async (tx) => {
    await tx.update(placeIdentity).set({ ...after, updatedAt: new Date() }).where(eq(placeIdentity.key, key));
  } });
  clearIdentityCache();
  return { ok: true, slug: cur.slug, message: input.changesCoverage ? `Scope saved. The scope version is now ${version}; data made under version ${cur.scopeVersion} will be listed as made for a different scope.` : `Scope saved${input.confirm ? ' and confirmed' : ' as a draft'}.` };
}

/** Marks a draft scope as confirmed exactly as it stands. */
export async function confirmScope(admin: AdminUser, key: string): Promise<EditResult> {
  const cur = await load(key); if (!cur) return { ok: false, error: 'No such place.' };
  if (cur.scopeStatus === 'confirmed') return { ok: true, slug: cur.slug, message: 'Already confirmed.' };
  await withAdminAudit({ actor: admin, entityType: 'place_identity', entityId: key, action: 'update', skipPlaceCache: true, before: { scopeStatus: cur.scopeStatus }, after: { scopeStatus: 'confirmed' }, write: async (tx) => {
    await tx.update(placeIdentity).set({ scopeStatus: 'confirmed', updatedAt: new Date() }).where(eq(placeIdentity.key, key));
  } });
  clearIdentityCache();
  return { ok: true, slug: cur.slug, message: 'Scope confirmed.' };
}
