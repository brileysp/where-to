'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './dna.css';

import { loadDnaState, saveDnaState } from '@/app/dna/actions';
import { applyTravelDNAWeights, applyBandsFromOnboarding } from '@/app/actions';
import { createInitialDNAState } from '@/lib/dna/state';
import { applySwipeToProfile } from '@/lib/dna/profile';
import { applyDimensionSignalsIfBroad } from '@/lib/dna/dimensions';
import { nextUnshownCalibrationMilestone } from '@/lib/dna/calibration';
import { computeDisplayCalibrationPercent, applyCalibrationFeedback } from '@/lib/dna/calibration-feedback';
import {
  checkDomainUnlocks,
  startDeepDive,
  isDeepDiveComplete,
  rebranchDeepDiveQueue,
  maybeExtendDeepDive,
  hasEarnedDomainNuance,
  resolveUnresolvedDomains,
} from '@/lib/dna/domains';
import { chooseNextCard } from '@/lib/dna/selection';
import { generateLearningCheck, type Feedback } from '@/lib/dna/summary';
import { seedProfileFromBands, seedProfileFromCompanions, seedProfileFromInterests } from '@/lib/dna/interests';
import { attributeLabel } from '@/lib/dna/card-visuals';
import { TUTORIAL_CARD, TUTORIAL_CARD_ID } from '@/lib/dna/tutorial-card';
import { BAND_DIMENSIONS } from '@/lib/scoring/constants';

import { IntroScreen } from './screens/IntroScreen';
import { StyleShortcutScreen } from './screens/StyleShortcutScreen';
import { BasicsScreen } from './screens/BasicsScreen';
import { SwipeScreen } from './screens/SwipeScreen';
import { DomainUnlockScreen } from './screens/DomainUnlockScreen';
import { DeepDiveRecapScreen } from './screens/DeepDiveRecapScreen';
import { LearningCheckScreen } from './screens/LearningCheckScreen';
import { SoftExitScreen } from './screens/SoftExitScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { RECALIBRATION_DURATION_MS } from './recalibration';

import type {
  CalibrationResponse,
  DimensionDef,
  DnaBands,
  DnaCard,
  DnaState,
  DomainDef,
  LearningCheck,
  Swipe,
  SwipeType,
  TensionDef,
} from '@/lib/dna/types';

interface Props {
  cards: DnaCard[];
  domains: DomainDef[];
  dimensions: DimensionDef[];
  tensions: TensionDef[];
}

function microUpdateTextFor(card: DnaCard, swipeType: SwipeType): string {
  const positive = Object.entries(card.preferenceSignals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => attributeLabel(k));
  const label = positive.join(' + ') || 'this one';
  if (swipeType === 'no') return `Noted: ${label} is probably lower priority.`;
  if (swipeType === 'love') return `Strong signal: ${label}.`;
  return `Signal added: ${label}.`;
}

const LEARNING_FEEDBACK_TO_RESPONSE: Record<Feedback, CalibrationResponse> = {
  confirmed: 'spot_on',
  rejected: 'not_really',
  unsure: 'not_sure',
};

type Screen =
  | 'intro'
  | 'styleShortcut'
  | 'basics'
  | 'swipe'
  | 'domainUnlock'
  | 'deepDiveRecap'
  | 'learningCheck'
  | 'softExit'
  | 'summary';

export function OnboardingFlow(props: Props) {
  const [initialState, setInitialState] = useState<DnaState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDnaState().then((saved) => {
      if (cancelled) return;
      setInitialState(saved ?? createInitialDNAState(props.dimensions));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialState) {
    return (
      <div className="dna-root">
        <p className="dna-screen">Loading…</p>
      </div>
    );
  }

  return <OnboardingFlowLoaded {...props} initialState={initialState} />;
}

function OnboardingFlowLoaded({ cards, domains, dimensions, tensions, initialState }: Props & { initialState: DnaState }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dnaState, setDnaState] = useState<DnaState>(initialState);
  // "Review Travel DNA" from the results sidebar links here with
  // ?entry=review to jump straight to the summary, bypassing Intro.
  const [screen, setScreen] = useState<Screen>(searchParams.get('entry') === 'review' ? 'summary' : 'intro');
  const [currentCard, setCurrentCard] = useState<DnaCard | null>(null);
  const [microText, setMicroText] = useState<string | undefined>(undefined);
  const [domainUnlockCtx, setDomainUnlockCtx] = useState<{ domainKey: string; onContinue: () => void } | null>(null);
  const [recapCtx, setRecapCtx] = useState<{ domainKey: string; onContinue: () => void } | null>(null);
  const [learningCheck, setLearningCheck] = useState<LearningCheck | null>(null);
  const [pendingLearningFeedback, setPendingLearningFeedback] = useState<Feedback | null>(null);
  const [pendingRating, setPendingRating] = useState<{
    targetType: 'dimension' | 'tension' | 'domain';
    targetId: string;
    title: string;
    response: CalibrationResponse;
  } | null>(null);
  // True while a rating/feedback click is still "resolving" — drives the
  // in-place recalibration animation on whichever screen is showing (see
  // CalibrationMeter's `recalibrating` prop and InsightRating's
  // `disabled`), replacing the old full-screen RecalibratingOverlay.
  const recalibrating = pendingRating !== null || pendingLearningFeedback !== null;

  useEffect(() => {
    if (!pendingRating) return;
    const t = setTimeout(handleRecalibrationComplete, RECALIBRATION_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRating]);

  useEffect(() => {
    if (!pendingLearningFeedback) return;
    const t = setTimeout(handleLearningRecalibrationComplete, RECALIBRATION_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLearningFeedback]);

  function commit(next: DnaState, swipe?: Swipe) {
    setDnaState(next);
    saveDnaState(next, swipe);
  }

  // ---- Basics screen toggles ----

  function toggleInterest(key: string) {
    const cur = new Set(dnaState.pickedInterests);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    commit({ ...dnaState, pickedInterests: [...cur] });
  }

  function toggleCompanion(key: string) {
    const cur = new Set(dnaState.companions);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    commit({ ...dnaState, companions: [...cur] });
  }

  function toggleBand(dimKey: keyof DnaBands, bandKey: string) {
    const dim = BAND_DIMENSIONS.find((d) => d.key === dimKey)!;
    const cur = new Set(dnaState.bands[dimKey] || []);
    if (cur.has(bandKey)) cur.delete(bandKey);
    else cur.add(bandKey);
    if (cur.size === 0) dim.bands.forEach((b) => cur.add(b.key)); // never allow zero — treat as "any"
    commit({ ...dnaState, bands: { ...dnaState.bands, [dimKey]: [...cur] } });
  }

  /** The first card in the deck: a one-time, non-scoring gesture tutorial for a brand-new user, otherwise a real card. */
  function pickFirstCard(state: DnaState): DnaCard | null {
    return state.tutorialShown ? chooseNextCard(state, cards, domains) : TUTORIAL_CARD;
  }

  function handleBasicsContinue() {
    if (!dnaState.companions.length) return;
    const next: DnaState = {
      ...dnaState,
      basicsCompleted: true,
      profile: seedProfileFromBands(
        seedProfileFromCompanions(
          seedProfileFromInterests(dnaState.profile, dnaState.pickedInterests),
          dnaState.companions,
        ),
        dnaState.bands,
      ),
    };
    commit(next);
    // Seed the main results app's "Open To" bands from what was just
    // picked here, same moment the legacy app did it — a one-time initial
    // value, not a live sync, so later slider-panel edits stay independent.
    applyBandsFromOnboarding(next.bands);
    const picked = pickFirstCard(next);
    setCurrentCard(picked);
    setScreen(picked ? 'swipe' : 'summary');
  }

  async function handleStyleShortcutContinue() {
    const next: DnaState = {
      ...dnaState,
      profile: seedProfileFromBands(
        seedProfileFromCompanions(
          seedProfileFromInterests(dnaState.profile, dnaState.pickedInterests),
          dnaState.companions,
        ),
        dnaState.bands,
      ),
      completedOnboarding: true,
    };
    await commitAndGoToResults(next);
  }

  // ---- Swipe cascade (mirrors legacy dna-ui.js's handleSwipe priority order) ----

  function handleSwipe(type: SwipeType) {
    if (!currentCard) return;
    const card = currentCard;

    // The tutorial card teaches the gesture but never counts as real
    // signal — any direction just dismisses it and reveals the first
    // actual card, with no profile/dimension/swipeCount/calibration change.
    if (card.id === TUTORIAL_CARD_ID) {
      const next: DnaState = { ...dnaState, tutorialShown: true };
      commit(next);
      setCurrentCard(chooseNextCard(next, cards, domains));
      return;
    }

    const micro = microUpdateTextFor(card, type);
    const swipe: Swipe = { cardId: card.id, type, timestamp: Date.now() };

    let next: DnaState = {
      ...dnaState,
      profile: applySwipeToProfile(dnaState.profile, card, type),
      dimensionState: applyDimensionSignalsIfBroad(dnaState.dimensionState, card, type, dimensions),
      swipes: [...dnaState.swipes, swipe],
      answeredCardIds: [...dnaState.answeredCardIds, card.id],
      swipeCount: dnaState.swipeCount + 1,
    };
    next.calibrationPercent = computeDisplayCalibrationPercent(next, cards);
    next = resolveUnresolvedDomains(next, cards);

    if (next.activeDeepDive && next.activeDeepDive.queue.includes(card.id)) {
      next = { ...next, activeDeepDive: { ...next.activeDeepDive, seenCount: next.activeDeepDive.seenCount + 1 } };
    }
    if (next.activeDeepDive) {
      next = rebranchDeepDiveQueue(next, cards, domains);
      next = maybeExtendDeepDive(next, cards, domains);
    }
    commit(next, swipe);

    if (next.activeDeepDive && isDeepDiveComplete(next)) {
      const finishedDomain = next.activeDeepDive.domain;
      const earnedNuance = hasEarnedDomainNuance(finishedDomain, next, cards);
      next = {
        ...next,
        completedDeepDives: next.completedDeepDives.includes(finishedDomain)
          ? next.completedDeepDives
          : [...next.completedDeepDives, finishedDomain],
        // No real conclusion to draw yet — keep this domain's remaining
        // unseen deep cards eligible, blended into ordinary swiping,
        // instead of permanently closing it out on a shrug.
        unresolvedDeepDomains:
          !earnedNuance && !next.unresolvedDeepDomains.includes(finishedDomain)
            ? [...next.unresolvedDeepDomains, finishedDomain]
            : next.unresolvedDeepDomains,
        activeDeepDive: null,
      };
      commit(next);
      showDeepDiveRecap(finishedDomain, next, micro);
      return;
    }

    const newlyUnlocked = checkDomainUnlocks(next, cards, domains);
    if (newlyUnlocked.length) {
      next = { ...next, unlockedDomains: [...next.unlockedDomains, ...newlyUnlocked] };
      if (next.activeDeepDive) {
        next = { ...next, pendingDeepDiveDomains: Array.from(new Set([...next.pendingDeepDiveDomains, ...newlyUnlocked])) };
        commit(next);
      } else {
        const [firstDomain, ...rest] = newlyUnlocked;
        next = { ...next, pendingDeepDiveDomains: Array.from(new Set([...next.pendingDeepDiveDomains, ...rest])) };
        commit(next);
        showDomainUnlock(firstDomain, next, micro);
        return;
      }
    }

    if (!next.activeDeepDive) {
      const lc = generateLearningCheck(next, cards, dimensions, tensions);
      if (lc) {
        next = { ...next, pendingLearningCheck: lc, lastLearningCheckSwipeCount: next.swipeCount };
        commit(next);
        setLearningCheck(lc);
        setScreen('learningCheck');
        return;
      }
    }

    proceedAfterSwipe(next, micro);
  }

  function showDomainUnlock(domainKey: string, state: DnaState, micro?: string) {
    setDnaState(state);
    setDomainUnlockCtx({ domainKey, onContinue: () => beginDeepDive(domainKey, state, micro) });
    setScreen('domainUnlock');
  }

  function beginDeepDive(domainKey: string, state: DnaState, micro?: string) {
    const dive = startDeepDive(domainKey, state, cards, domains);
    if (!dive.queue.length) {
      const next: DnaState = {
        ...state,
        completedDeepDives: state.completedDeepDives.includes(domainKey)
          ? state.completedDeepDives
          : [...state.completedDeepDives, domainKey],
        unresolvedDeepDomains: state.unresolvedDeepDomains.includes(domainKey)
          ? state.unresolvedDeepDomains
          : [...state.unresolvedDeepDomains, domainKey],
      };
      commit(next);
      showDeepDiveRecap(domainKey, next, micro);
      return;
    }
    const next: DnaState = { ...state, activeDeepDive: dive };
    commit(next);
    proceedAfterSwipe(next, micro);
  }

  function showDeepDiveRecap(domainKey: string, state: DnaState, micro?: string) {
    setDnaState(state);
    setRecapCtx({ domainKey, onContinue: () => afterDeepDiveEnds(state, micro) });
    setScreen('deepDiveRecap');
  }

  function afterDeepDiveEnds(state: DnaState, micro?: string) {
    const pending = state.pendingDeepDiveDomains;
    if (pending.length) {
      const [nextDomain, ...rest] = pending;
      const next: DnaState = { ...state, pendingDeepDiveDomains: rest };
      commit(next);
      showDomainUnlock(nextDomain, next, micro);
      return;
    }
    proceedAfterSwipe(state, micro);
  }

  function proceedAfterSwipe(state: DnaState, micro?: string) {
    if (!state.activeDeepDive) {
      const milestone = nextUnshownCalibrationMilestone(state);
      if (milestone) {
        const next: DnaState = { ...state, calibrationMilestonesShown: [...state.calibrationMilestonesShown, milestone] };
        commit(next);
        setMicroText(undefined);
        setScreen(milestone >= 100 ? 'summary' : 'softExit');
        return;
      }
    }
    const picked = chooseNextCard(state, cards, domains);
    setDnaState(state);
    setCurrentCard(picked);
    setMicroText(micro);
    setScreen(picked ? 'swipe' : 'summary');
  }

  // ---- Learning Check feedback (swipe-flow interstitial) — same
  // recalibration animation + calibrationAdjustment nudge as the Summary
  // screen's insight ratings, via the shared applyCalibrationFeedback.

  function handleLearningFeedbackRequest(feedback: Feedback) {
    setPendingLearningFeedback(feedback);
  }

  function handleLearningRecalibrationComplete() {
    if (!pendingLearningFeedback || !learningCheck) return;
    let next = applyCalibrationFeedback(
      dnaState,
      learningCheck.kind,
      learningCheck.refId,
      learningCheck.title,
      LEARNING_FEEDBACK_TO_RESPONSE[pendingLearningFeedback],
      dimensions,
      tensions,
      cards,
    );
    next = { ...next, pendingLearningCheck: null };
    commit(next);
    setLearningCheck(null);
    setPendingLearningFeedback(null);
    proceedAfterSwipe(next);
  }

  // ---- Calibration & Confidence Feedback (Summary screen insight ratings) ----

  function handleRateInsightRequest(
    targetType: 'dimension' | 'tension' | 'domain',
    targetId: string,
    title: string,
    response: CalibrationResponse,
  ) {
    // Defer the actual state change until the recalibration animation
    // finishes, so the bar's before->after change reads as the payoff of
    // "the model thinking," not an instant click reaction.
    setPendingRating({ targetType, targetId, title, response });
  }

  function handleRecalibrationComplete() {
    if (!pendingRating) return;
    const { targetType, targetId, title, response } = pendingRating;
    const next = applyCalibrationFeedback(dnaState, targetType, targetId, title, response, dimensions, tensions, cards);
    commit(next);
    setPendingRating(null);
  }

  function handleKeepSwiping() {
    const picked = chooseNextCard(dnaState, cards, domains);
    setCurrentCard(picked);
    setMicroText(undefined);
    setScreen(picked ? 'swipe' : 'summary');
  }

  // The single path off the swipe flow back to results — used by every
  // exit point (finishing, the style-shortcut, and BOTH "back" links),
  // not just the "official" finish button. Any of them can be the last
  // thing a user taps after swiping for a while, so all of them must
  // apply Travel DNA weights, not just the one labeled "continue" — a
  // "← Back to recommendations" link that skipped this was the actual
  // cause of Travel DNA not being preselected on the results page.
  async function commitAndGoToResults(next: DnaState) {
    setDnaState(next);
    // Both awaited, in order, before navigating: the results page's
    // server component re-fetches preferences the instant router.push
    // resolves, so firing these and navigating immediately risked a race
    // where '/' loaded before the weights write landed — showing the
    // stale/default persona instead of Travel DNA.
    await saveDnaState(next);
    await applyTravelDNAWeights();
    router.push('/');
  }

  async function finishOnboarding() {
    await commitAndGoToResults({ ...dnaState, completedOnboarding: true });
  }

  function handleReset() {
    if (typeof window !== 'undefined' && !window.confirm('Reset your Travel DNA? This clears all swipes and starts over.')) {
      return;
    }
    const next = createInitialDNAState(dimensions);
    commit(next);
    setCurrentCard(null);
    setMicroText(undefined);
    setDomainUnlockCtx(null);
    setRecapCtx(null);
    setLearningCheck(null);
    setScreen('intro');
  }

  function handleIntroStart() {
    if (!dnaState.basicsCompleted) {
      setScreen('basics');
      return;
    }
    const picked = pickFirstCard(dnaState);
    setCurrentCard(picked);
    setScreen(picked ? 'swipe' : 'summary');
  }

  const screenNode = (() => {
    switch (screen) {
      case 'intro':
        return <IntroScreen onStart={handleIntroStart} onSkip={() => setScreen('styleShortcut')} />;

      case 'styleShortcut':
        return (
          <StyleShortcutScreen
            picked={dnaState.pickedInterests}
            onToggle={toggleInterest}
            onContinue={handleStyleShortcutContinue}
            onBack={() => setScreen('intro')}
          />
        );

      case 'basics':
        return (
          <BasicsScreen
            pickedInterests={dnaState.pickedInterests}
            onToggleInterest={toggleInterest}
            companions={dnaState.companions}
            onToggleCompanion={toggleCompanion}
            bands={dnaState.bands}
            onToggleBand={toggleBand}
            onContinue={handleBasicsContinue}
          />
        );

      case 'swipe':
        if (!currentCard) return null;
        return (
          <SwipeScreen
            dnaState={dnaState}
            currentCard={currentCard}
            domains={domains}
            microText={microText}
            onSwipe={handleSwipe}
            onSeeMatches={finishOnboarding}
            onBack={finishOnboarding}
          />
        );

      case 'domainUnlock':
        if (!domainUnlockCtx) return null;
        return <DomainUnlockScreen domainKey={domainUnlockCtx.domainKey} domains={domains} onContinue={domainUnlockCtx.onContinue} />;

      case 'deepDiveRecap':
        if (!recapCtx) return null;
        return (
          <DeepDiveRecapScreen
            domainKey={recapCtx.domainKey}
            dnaState={dnaState}
            cards={cards}
            domains={domains}
            recalibrating={recalibrating}
            onContinue={recapCtx.onContinue}
            onRateInsight={handleRateInsightRequest}
          />
        );

      case 'learningCheck':
        if (!learningCheck) return null;
        return (
          <LearningCheckScreen
            learningCheck={learningCheck}
            calibrationPercent={dnaState.calibrationPercent}
            onFeedback={handleLearningFeedbackRequest}
          />
        );

      case 'softExit':
        return (
          <SoftExitScreen percent={dnaState.calibrationPercent} onShowMatches={finishOnboarding} onKeepRefining={handleKeepSwiping} />
        );

      case 'summary':
        return (
          <SummaryScreen
            dnaState={dnaState}
            cards={cards}
            dimensions={dimensions}
            tensions={tensions}
            domains={domains}
            recalibrating={recalibrating}
            onContinue={finishOnboarding}
            onKeepSwiping={handleKeepSwiping}
            onReset={handleReset}
            onBack={finishOnboarding}
            onRateInsight={handleRateInsightRequest}
          />
        );

      default:
        return null;
    }
  })();

  return <div className="dna-root">{screenNode}</div>;
}
