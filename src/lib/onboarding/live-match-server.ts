import { getMatchFits, getMatchSetups } from '@/lib/db/queries/match-data';
import { loadMatchSettings } from '@/lib/scoring/matchSettingsServer';
import { liveMatch, type LiveMatch } from './live-factors';
import type { TravelProfile } from './profile';

/**
 * What a saved traveler's chips and answers do to every place, worked out on the server so the full results page ranks the same way the
 * onboarding shortlist did. Null when the profile has no chips or answers (nothing to apply), so travelers who never used the new flow see
 * no change at all.
 */
export async function liveMatchForProfile(profile: TravelProfile | null): Promise<LiveMatch | null> {
  if (!profile) return null;
  const hasPicks = Object.keys(profile.qa ?? {}).length > 0 || Object.values(profile.subs).some((v) => v.length > 0);
  if (!hasPicks) return null;
  const setups = await getMatchSetups();
  const interests = Object.keys(profile.levels).filter((k) => setups[k]);
  if (!interests.length) return null;
  const [fits, { settings }] = await Promise.all([getMatchFits(interests), loadMatchSettings()]);
  const m = liveMatch({ interests, setups, fits, ticked: profile.subs, qa: profile.qa ?? {}, settings });
  return Object.keys(m.factors).length || Object.keys(m.notes).length ? m : null;
}
