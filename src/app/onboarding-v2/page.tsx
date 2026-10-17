import { notFound } from 'next/navigation';
import { OnboardingV2Flow } from '@/components/onboarding-v2/OnboardingV2Flow';
import { getLiveInterestChips, getPlaceCoords } from '@/lib/db/queries/onboarding-chips';
import { getListScoredPlaces } from '@/lib/db/queries/places';
import { getAllDnaCards, getAllDomainDefs, getAllDimensionDefs } from '@/lib/db/queries/dna-content';
import { getInterestEmojiOverrides, getInterestShortNames } from '@/lib/scoring/interestMeta';
import { loadFirstName } from '@/app/actions';
import { loadTravelProfile } from './actions';

export const dynamic = 'force-dynamic';

/**
 * The new onboarding flow (docs/onboarding-v2/SPEC.md). Off unless ONBOARDING_V2=1 is set, so nothing changes for anyone until the
 * owner approves the switch. When it is on, the old flow's address (/dna) sends visitors here.
 *   ?fresh=1   ignores what the traveler saved, to see the first-time flow again.
 *   ?review=1  opens the Travel DNA page directly (the "Review Travel DNA" link).
 */
export default async function OnboardingV2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.ONBOARDING_V2 !== '1') notFound();
  const params = await searchParams;
  const fresh = params.fresh === '1';
  const [chips, destinations, cards, domains, dimensions, emojiOverrides, shortNames, coords, saved, name] = await Promise.all([
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
  ]);
  return <OnboardingV2Flow data={{ chips, destinations, cards, domains, dimensions, emojiOverrides, shortNames, coords }} entry={{ saved, name, review: params.review === '1' && !!saved }} />;
}
