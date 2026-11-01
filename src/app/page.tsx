import { redirect } from 'next/navigation';
import { loadFeatures } from '@/lib/featuresServer';
import { onboardingV2On } from '@/lib/features';
import { getListScoredPlaces } from '@/lib/db/queries/places';
import { loadUserPreferences, listSavedProfiles, loadFirstName } from '@/app/actions';
import { loadDnaState } from '@/app/dna/actions';
import { loadTravelProfile } from '@/app/onboarding-v2/actions';
import { getInterestEmojiOverrides, getInterestShortNames } from '@/lib/scoring/interestMeta';
import { ResultsApp } from '@/components/results/ResultsApp';
import { loadTrips } from '@/app/onboarding-v2/trip-actions';
import { liveMatchForProfile, tripEffectForProfile } from '@/lib/onboarding/live-match-server';

const DEFAULT_DNA_HINT = 'Swipe through experiences to teach Where To? your travel style.';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [destinations, preferences, savedProfiles, dnaState, travelProfile, firstName, emojiOverrides, shortNames] = await Promise.all([
    getListScoredPlaces(),
    loadUserPreferences(),
    listSavedProfiles(),
    loadDnaState(),
    loadTravelProfile(),
    loadFirstName(),
    getInterestEmojiOverrides(),
    getInterestShortNames(),
  ]);

  // What the traveler's chips and answers (new onboarding) do to each place; null for everyone who never used it.
  // The trip settings come from the traveler's active trip (the one saved most recently), if they have any.
  const activeTrip = (await loadTrips())[0] ?? null;
  const [match, trip] = await Promise.all([liveMatchForProfile(travelProfile, activeTrip), tripEffectForProfile(travelProfile, activeTrip)]);

  // A visitor with nothing saved (no profile, no swipes, no preset, no saved custom profile) is new: they always start in the new onboarding.
  // `?browse=1` is the way past it for a person who only wants the list. Everyone who finished onboarding has a saved profile, so there is no loop.
  if (!travelProfile && !(dnaState && dnaState.swipeCount > 0) && !preferences?.personaId && savedProfiles.length === 0 && onboardingV2On(await loadFeatures())) {
    const params = await searchParams;
    if (params.browse !== '1') redirect('/onboarding-v2');
  }

  // A traveler who finished the new onboarding has a saved profile even when they answered no swipe questions, so the list is theirs to see.
  const hasDnaSignal = (!!dnaState && dnaState.swipeCount > 0) || !!travelProfile;

  const dnaHint = !hasDnaSignal
    ? DEFAULT_DNA_HINT
    : !dnaState || dnaState.swipeCount === 0
      ? 'Built from the interests and details you chose in onboarding.'
      : (() => {
        const confirmedCount = (dnaState!.confirmedTensions?.length ?? 0) + (dnaState!.confirmedDimensionLearnings?.length ?? 0);
        return `Calibrated at ${dnaState!.calibrationPercent}% — ${dnaState!.swipeCount} swipes, ${confirmedCount} pattern${confirmedCount === 1 ? '' : 's'} confirmed.`;
      })();

  return (
    <ResultsApp
      destinations={destinations}
      initialPreferences={preferences}
      initialSavedProfiles={savedProfiles}
      initialDnaHint={dnaHint}
      initialHasDnaSignal={hasDnaSignal}
      userFirstName={firstName}
      emojiOverrides={emojiOverrides}
      shortNames={shortNames}
      matchFactors={match?.factors}
      matchNotes={match?.notes}
      tripPlaceFactors={trip?.placeFactors}
      tripHidden={trip?.hidden}
      tripPeakGain={trip?.peakGain}
    />
  );
}
