// 18 Nov 2026 (step 4 of docs/place-naming-plan.md): admin place addresses use the readable slug (/admin/destinations/myanmar/profile). The address part may be a key, a slug, a retired slug
// or an old id; anything other than the current slug is redirected to the slug address, so old bookmarks and links built from a key keep working. Server only.
import { notFound, redirect } from 'next/navigation';
import { resolvePlace } from './lookup';

/** Returns the place key for an admin address part, redirecting to the canonical slug address first when needed. `suffix` is the rest of the path ("/profile") and `query` an optional query string to keep. */
export async function resolveAdminPlace(param: string, suffix: string, query = ''): Promise<{ key: string; slug: string; label: string }> {
  const r = await resolvePlace(decodeURIComponent(param));
  if (!r) notFound();
  if (param !== r.slug) redirect(`/admin/destinations/${r.slug}${suffix}${query}`);
  return { key: r.key, slug: r.slug, label: r.label };
}
