'use server';

// 18 Nov 2026 (step 5 of docs/place-naming-plan.md): the forms on the "Names & scope" screens. Each one calls the matching function in src/lib/places/edit.ts and comes back to the screen with a message.
import { redirect } from 'next/navigation';
import { requireAdminUser } from '@/lib/admin/auth';
import { changeLabel, changeSlug, changeScope, confirmScope, type EditResult } from '@/lib/places/edit';

const back = (slug: string, r: EditResult) => redirect(`/admin/destinations/${slug}/identity?${r.ok ? 'saved' : 'error'}=${encodeURIComponent(r.ok ? r.message : r.error)}`);
const str = (f: FormData, k: string) => String(f.get(k) ?? '');

export async function renamePlace(formData: FormData): Promise<void> {
  const admin = await requireAdminUser(); const key = str(formData, 'key');
  const r = await changeLabel(admin, key, str(formData, 'label'), { reason: str(formData, 'reason'), alsoSlug: formData.get('alsoSlug') === 'on' });
  back(r.ok ? r.slug : str(formData, 'slug'), r);
}
export async function changePlaceSlug(formData: FormData): Promise<void> {
  const admin = await requireAdminUser(); const r = await changeSlug(admin, str(formData, 'key'), str(formData, 'newSlug'));
  back(r.ok ? r.slug : str(formData, 'slug'), r);
}
export async function savePlaceScope(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();
  const r = await changeScope(admin, str(formData, 'key'), { level: str(formData, 'level'), anchorsText: str(formData, 'anchors'), note: str(formData, 'note'), changesCoverage: formData.get('changesCoverage') === 'on', confirm: str(formData, 'intent') === 'confirm' });
  back(str(formData, 'slug'), r);
}
/** The one-click Confirm on the list: confirms the scope as it stands and returns to the list. */
export async function confirmPlaceScope(formData: FormData): Promise<void> {
  const admin = await requireAdminUser(); const r = await confirmScope(admin, str(formData, 'key'));
  redirect(`/admin/destinations/identity?${str(formData, 'status') ? `status=${encodeURIComponent(str(formData, 'status'))}&` : ''}${r.ok ? 'saved' : 'error'}=${encodeURIComponent(r.ok ? r.message : r.error)}`);
}
