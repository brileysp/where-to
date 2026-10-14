'use server';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { profiles } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/supabase/current-user';
import { isCountryCode } from '@/lib/units/countries';
import { HOME_COUNTRY_COOKIE } from '@/lib/units/server';

const YEAR = 60 * 60 * 24 * 365;

/** Save the visitor's home country: in a cookie for this browser, and on their account so it follows them to another one. */
export async function setHomeCountry(code: string): Promise<{ ok: boolean }> {
  if (!isCountryCode(code)) return { ok: false };
  (await cookies()).set(HOME_COUNTRY_COOKIE, code, { maxAge: YEAR, path: '/', sameSite: 'lax' });
  const userId = await getCurrentUserId();
  if (userId) await db.insert(profiles).values({ id: userId, homeCountry: code }).onConflictDoUpdate({ target: profiles.id, set: { homeCountry: code } });
  return { ok: true };
}

/**
 * First visit on a browser without a saved choice: look for a country on the account (a person who set it on another browser).
 * Found: it becomes this browser's cookie. Not found: the cookie is set to "auto" so the account is not checked again on every page.
 */
export async function syncHomeCountry(): Promise<{ country: string | null }> {
  const userId = await getCurrentUserId();
  let country: string | null = null;
  if (userId) {
    const [row] = await db.select({ c: profiles.homeCountry }).from(profiles).where(eq(profiles.id, userId));
    if (isCountryCode(row?.c)) country = row.c;
  }
  (await cookies()).set(HOME_COUNTRY_COOKIE, country ?? 'auto', { maxAge: YEAR, path: '/', sameSite: 'lax' });
  return { country };
}
