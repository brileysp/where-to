/**
 * Feature switches that are flipped from the database, not from hosting settings (one row in app_settings, key 'features'). Nothing here needs a
 * deploy: changing the row takes effect within about ten seconds. `scripts/set-feature.ts` flips them.
 *
 *   onboardingV2   the new onboarding flow is ON for everyone unless this is set to 0 (the old flow's address, /dna, sends visitors to it). 0 is the kill switch.
 *   previewCode    a number the owner can put in the address (/onboarding-v2?preview=NUMBER) to try the new flow while it is off for everyone.
 */

export const FEATURES_KEY = 'features';

export type FeatureValues = Record<string, number>;

/** True unless the owner has explicitly switched the new onboarding off (onboardingV2 = 0). Missing or unreadable settings mean on. */
export function onboardingV2On(values: FeatureValues | null | undefined): boolean {
  return values?.onboardingV2 !== 0;
}

/** True when the visitor may see the new onboarding: it is on for everyone, or they brought the owner's preview code. */
export function onboardingV2Allowed(values: FeatureValues | null | undefined, previewParam: string | string[] | undefined): boolean {
  if (onboardingV2On(values)) return true;
  const code = values?.previewCode;
  if (typeof code !== 'number' || !Number.isInteger(code) || code < 100000) return false;
  return typeof previewParam === 'string' && previewParam === String(code);
}
