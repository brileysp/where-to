import { getAllScoredPlaces } from '@/lib/db/queries/places';
import { loadUserPreferences, listSavedProfiles, loadFirstName } from '@/app/actions';
import { loadDnaState } from '@/app/dna/actions';
import { getInterestEmojiOverrides } from '@/lib/scoring/interestMeta';
import { ResultsApp } from '@/components/results/ResultsApp';

const DEFAULT_DNA_HINT = 'Swipe through experiences to teach Where To? your travel style.';

export default async function Home() {
  const [destinations, preferences, savedProfiles, dnaState, firstName, emojiOverrides] = await Promise.all([
    getAllScoredPlaces(),
    loadUserPreferences(),
    listSavedProfiles(),
    loadDnaState(),
    loadFirstName(),
    getInterestEmojiOverrides(),
  ]);

  const hasDnaSignal = !!dnaState && dnaState.swipeCount > 0;

  const dnaHint = !hasDnaSignal
    ? DEFAULT_DNA_HINT
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
    />
  );
}
