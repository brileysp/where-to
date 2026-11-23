import { notFound } from 'next/navigation';
import { OnboardingV2Flow } from '@/components/onboarding-v2/OnboardingV2Flow';
import { getLiveInterestChips, getPlaceCoords, getPlaceSettingTags } from '@/lib/db/queries/onboarding-chips';
import { getListScoredPlaces } from '@/lib/db/queries/places';
import { getAllDnaCards, getAllDomainDefs, getAllDimensionDefs } from '@/lib/db/queries/dna-content';
import { getInterestEmojiOverrides, getInterestShortNames } from '@/lib/scoring/interestMeta';
import { loadFirstName } from '@/app/actions';
import { loadTravelProfile } from './actions';
import { loadTrips } from './trip-actions';
import { loadFeatures } from '@/lib/featuresServer';
import { getMatchSetups } from '@/lib/db/queries/match-data';
import { regionsForPlaces } from '@/lib/onboarding/regions';
import { loadMatchSettings } from '@/lib/scoring/matchSettingsServer';
import { getTravelFacts } from '@/lib/db/queries/travel-needs';
import { onboardingV2Allowed } from '@/lib/features';

export const dynamic = 'force-dynamic';

/**
 * The new onboarding flow (docs/onboarding-v2/SPEC.md). Off unless the database switch is on (lib/features.ts), so nothing changes for anyone
 * until the owner approves it. When it is on, the old flow's address (/dna) sends visitors here. While it is off, ?preview=CODE (the owner's code)
 * opens it for trying.
 *   ?fresh=1   ignores what the traveler saved, to see the first-time flow again.
 *   ?review=1  opens the Travel DNA page directly (the "Review Travel DNA" link).
 *   ?list=1    a returning traveler goes straight to their list instead of the welcome questions (where the home address sends them).
 */
export default async function OnboardingV2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (!onboardingV2Allowed(await loadFeatures(), params.preview)) notFound();
  const fresh = params.fresh === '1';
  const [chips, destinations, cards, domains, dimensions, emojiOverrides, shortNames, coords, saved, name, setups, matchSettings, travelFacts, trips, settingTags] = await Promise.all([
    // (the trips load last in the list below)
    getLiveInterestChips(),
    getListScoredPlaces(),
    getAllDnaCards(),
    getAllDomainDefs(),
    getAllDimensionDefs(),
    getInterestEmojiOverrides(),
    getInterestShortNames(),
    getPlaceCoords(),
    fresh ? Promise.resolve(null) : loadTravelProfile(),
    loadFirstName(),
    getMatchSetups(),
    loadMatchSettings().then((m) => m.settings),
    getTravelFacts(),
    fresh ? Promise.resolve([]) : loadTrips(),
    getPlaceSettingTags(),
  ]);
  return <OnboardingV2Flow data={{ travelFacts, chips, destinations, cards, domains, dimensions, emojiOverrides, shortNames, coords, setups, matchSettings, regions: regionsForPlaces(coords), settingTags }} entry={{ saved, name, review: params.review === '1' && !!saved, list: params.list === '1' && !!saved, fresh, trips }} />;
}
