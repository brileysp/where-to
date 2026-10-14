import { cookies, headers } from 'next/headers';
import { isCountryCode, regionFromAcceptLanguage } from './countries';
import { unitsForCountry, type Units } from '@/lib/text/units';

export const HOME_COUNTRY_COOKIE = 'home_country';

/** 'saved': the visitor chose a country. 'auto': they have not, and the account has none either. 'unset': not checked yet on this browser. */
export type UnitsSource = 'saved' | 'auto' | 'unset';
export interface UnitsContext { country: string | null; source: UnitsSource; units: Units }

/**
 * Which units this request should show. The cookie holds the chosen country (or "auto" once the account has been checked and has none);
 * without a choice the country is guessed from the browser's language region, and an unknown country gets US units.
 */
export async function getUnitsContext(): Promise<UnitsContext> {
  const value = (await cookies()).get(HOME_COUNTRY_COOKIE)?.value;
  if (isCountryCode(value)) return { country: value, source: 'saved', units: unitsForCountry(value) };
  const guess = regionFromAcceptLanguage((await headers()).get('accept-language'));
  return { country: guess, source: value === 'auto' ? 'auto' : 'unset', units: unitsForCountry(guess) };
}
