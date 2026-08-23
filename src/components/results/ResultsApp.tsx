'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERSONAS, SLIDERS, MONTH_NAMES, allBandsSelected } from '@/lib/scoring/constants';
import { computeRankedDestinations } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';
import {
  saveUserPreferences,
  applyTravelDNAWeights,
  updateSelectedStyles,
  listSavedProfiles,
  saveNamedProfile,
  deleteNamedProfile,
  type UserPreferencesData,
  type LoadedUserPreferences,
  type SavedProfileData,
} from '@/app/actions';
import { resetDnaState } from '@/app/dna/actions';
import { PersonaPicker } from './PersonaPicker';
import { SliderPanel } from './SliderPanel';
import { BandDimensionPicker } from './BandDimensionPicker';
import { MonthGrid } from './MonthGrid';
import { MonthPrompt } from './MonthPrompt';
import { StartPrompt } from './StartPrompt';
import { FetchingResults } from './FetchingResults';
import { SearchBox } from './SearchBox';
import { ResultsList } from './ResultsList';
import { DnaPanel } from './DnaPanel';
import { BackToTopButton } from './BackToTopButton';
import './results.css';

const DEFAULT_HINT = 'Swipe through experiences to teach Where To? your travel style.';
const RESET_CONFIRM = "Reset sliders and Open To bands to the current persona's defaults?";
// Ranking is actually instant (client-side, synchronous) — this is a
// purely perceptual delay so picking a month doesn't feel suspiciously
// fast, like nothing happened. Real work still finishes well under it.
// Kept comfortably longer than the scroll-into-view animation below so
// the fetching state is still on screen once that scroll settles.
const FETCHING_RESULTS_MS = 900;

function weightsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  return SLIDERS.every((s) => (a[s.key] || 0) === (b[s.key] || 0));
}

interface Props {
  destinations: ScoredDestination[];
  initialPreferences: LoadedUserPreferences | null;
  initialSavedProfiles: SavedProfileData[];
  initialDnaHint: string;
  initialHasDnaSignal: boolean;
}

export function ResultsApp({ destinations, initialPreferences, initialSavedProfiles, initialDnaHint, initialHasDnaSignal }: Props) {
  const router = useRouter();

  // No default persona/weights for a brand-new visitor — recommendations
  // stay hidden (see `hasStarted` below) until they actually pick
  // something, rather than silently ranking against a persona nobody
  // chose. A real preferences row with personaId === null still means
  // Travel DNA (or a saved custom profile) is intentionally active.
  const [personaId, setPersonaId] = useState<string | null>(initialPreferences ? initialPreferences.personaId : null);
  const [weights, setWeights] = useState<Record<string, number>>(initialPreferences?.weights ?? {});
  const [bands, setBands] = useState<Record<string, string[]>>(initialPreferences?.bands ?? allBandsSelected());
  const [month, setMonth] = useState<number | null>(initialPreferences?.month ?? null);
  const [monthChosen, setMonthChosen] = useState(initialPreferences?.monthChosen ?? false);
  const [showAllSliders, setShowAllSliders] = useState(initialPreferences?.showAllSliders ?? false);
  const [savedProfiles, setSavedProfiles] = useState(initialSavedProfiles);
  const [dnaHint, setDnaHint] = useState(initialDnaHint || DEFAULT_HINT);
  const [earnedStyles, setEarnedStyles] = useState<Record<string, string[]>>(initialPreferences?.earnedStyles ?? {});
  const [selectedStyles, setSelectedStyles] = useState<Record<string, string[]>>(initialPreferences?.selectedStyles ?? {});

  // Recommendations stay hidden behind a StartPrompt until this is true —
  // set once at load from real evidence (a saved persona, real Travel DNA
  // signal, or a saved custom profile), then flipped explicitly by every
  // action that constitutes "picking a preset or swiping."
  const [hasStarted, setHasStarted] = useState(
    Boolean(initialPreferences?.personaId) ||
      initialHasDnaSignal ||
      Boolean(initialPreferences && initialSavedProfiles.some((p) => weightsEqual(p.weights, initialPreferences.weights))),
  );

  const [visibleCount, setVisibleCount] = useState(20);
  const [breakdownExpanded, setBreakdownExpanded] = useState<Set<string>>(new Set());
  const [cardPreviewMonth, setCardPreviewMonth] = useState<Record<string, number>>({});
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isFetchingResults, setIsFetchingResults] = useState(false);

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Scroll target on month pick is the month panel itself, not the results
  // section below it — putting the month panel at the very TOP of the
  // viewport is what pushes "Open To" (and everything else above it) out
  // of view and gives the results section below the most possible room,
  // which is the actual point of scrolling at all here.
  const monthPanelRef = useRef<HTMLDivElement>(null);
  // Where the floating back-to-top button scrolls to — the results
  // heading, right above the search box, so tapping it lands you exactly
  // where "search for something else" already lives.
  const resultsTopRef = useRef<HTMLHeadingElement>(null);

  // null = a saved custom profile is active, not Travel DNA specifically.
  const activeSavedProfile = personaId === null ? (savedProfiles.find((p) => weightsEqual(p.weights, weights)) ?? null) : null;
  // hasStarted excludes the "landed here fresh, nothing chosen yet" case,
  // which also has personaId === null and no matching saved profile —
  // without it this would misreport as "Travel DNA active" before the
  // user has done anything.
  const isDnaActive = hasStarted && personaId === null && !activeSavedProfile;

  function persist(next: UserPreferencesData) {
    saveUserPreferences(next);
  }

  function persistDebounced(next: UserPreferencesData) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(next), 400);
  }

  const ranked = useMemo(() => {
    if (!monthChosen || !month) return [];
    return computeRankedDestinations(destinations, weights, month, bands, selectedStyles);
  }, [destinations, weights, month, bands, monthChosen, selectedStyles]);

  // ---- Persona / sliders / bands / month ----

  function handleSelectPersona(id: string) {
    const persona = PERSONAS.find((p) => p.id === id);
    if (!persona) return;
    const nextWeights = { ...persona.weights };
    setPersonaId(id);
    setWeights(nextWeights);
    setShowAllSliders(false);
    setVisibleCount(20);
    setHasStarted(true);
    persist({ personaId: id, weights: nextWeights, bands, month, monthChosen, showAllSliders: false });
  }

  function handleSliderChange(key: string, value: number) {
    const nextWeights = { ...weights, [key]: value };
    setWeights(nextWeights);
    setVisibleCount(20);
    persistDebounced({ personaId, weights: nextWeights, bands, month, monthChosen, showAllSliders });
  }

  function handleToggleBand(dimKey: string, bandKey: string) {
    const dim = allBandsSelected();
    const cur = new Set(bands[dimKey] || []);
    if (cur.has(bandKey)) cur.delete(bandKey);
    else cur.add(bandKey);
    if (cur.size === 0) dim[dimKey].forEach((k) => cur.add(k)); // never allow zero — "any"
    const nextBands = { ...bands, [dimKey]: [...cur] };
    setBands(nextBands);
    setVisibleCount(20);
    persist({ personaId, weights, bands: nextBands, month, monthChosen, showAllSliders });
  }

  function handleChooseMonth(m: number) {
    setMonth(m);
    setMonthChosen(true);
    setCardPreviewMonth({});
    setVisibleCount(20);
    persist({ personaId, weights, bands, month: m, monthChosen: true, showAllSliders });

    // Ranking below is instant either way — this just holds the reveal
    // for a beat so it reads as "fetching," not "nothing happened." The
    // actual scroll-into-view happens in the effect below, once the DOM
    // has already shrunk to the (short) fetching placeholder — not here,
    // synchronously, against the DOM as it looks BEFORE that swap. Doing
    // it here raced React's commit: scrollIntoView would measure the
    // still-long results list, kick off a scroll toward that stale
    // target, then the list would collapse out from under it mid-flight,
    // leaving the page scrolled to an arbitrary spot instead of actually
    // at the results section.
    setIsFetchingResults(true);
    if (fetchingTimerRef.current) clearTimeout(fetchingTimerRef.current);
    fetchingTimerRef.current = setTimeout(() => setIsFetchingResults(false), FETCHING_RESULTS_MS);
  }

  function handleToggleStyle(sliderKey: string, styleKey: string) {
    const current = selectedStyles[sliderKey] || [];
    const isSelected = current.includes(styleKey);
    const next = isSelected ? current.filter((k) => k !== styleKey) : [...current, styleKey];
    if (!next.length) return; // never allow scoping to nothing
    const nextSelected = { ...selectedStyles, [sliderKey]: next };
    setSelectedStyles(nextSelected);
    updateSelectedStyles(sliderKey, next);
  }

  function handleToggleShowAll() {
    const next = !showAllSliders;
    setShowAllSliders(next);
    persist({ personaId, weights, bands, month, monthChosen, showAllSliders: next });
  }

  function handleResetSliders() {
    if (typeof window !== 'undefined' && !window.confirm(RESET_CONFIRM)) return;
    const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];
    const nextWeights = { ...persona.weights };
    const nextBands = allBandsSelected();
    setWeights(nextWeights);
    setBands(nextBands);
    setShowAllSliders(false);
    setVisibleCount(20);
    persist({ personaId, weights: nextWeights, bands: nextBands, month, monthChosen, showAllSliders: false });
  }

  // ---- Saved profiles ----

  function handleSelectProfile(id: string) {
    const profile = savedProfiles.find((p) => p.id === id);
    if (!profile) return;
    setWeights(profile.weights);
    setBands(profile.bands);
    setPersonaId(null);
    setShowAllSliders(true);
    setVisibleCount(20);
    setHasStarted(true);
    persist({ personaId: null, weights: profile.weights, bands: profile.bands, month, monthChosen, showAllSliders: true });
  }

  async function handleSaveProfile() {
    if (typeof window === 'undefined') return;
    const name = window.prompt('Save current sliders as…');
    if (!name || !name.trim()) return;
    await saveNamedProfile(name.trim(), weights, bands);
    setSavedProfiles(await listSavedProfiles());
  }

  async function handleDeleteProfile() {
    const matched = savedProfiles.find((p) => weightsEqual(p.weights, weights));
    if (!matched) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete saved profile "${matched.name}"?`)) return;
    await deleteNamedProfile(matched.id);
    setSavedProfiles(await listSavedProfiles());
  }

  // ---- Travel DNA sidebar actions ----

  async function handleUseTravelDNA() {
    const result = await applyTravelDNAWeights();
    if (!result.applied || !result.weights) {
      if (typeof window !== 'undefined') {
        window.alert('No Travel DNA signal yet — click "Keep refining" to swipe through a few experience cards first.');
      }
      return;
    }
    setWeights(result.weights);
    setEarnedStyles(result.earnedStyles ?? {});
    setSelectedStyles(result.selectedStyles ?? {});
    setPersonaId(null);
    setShowAllSliders(true);
    setVisibleCount(20);
    setHasStarted(true);
  }

  function handleKeepRefining() {
    router.push('/dna');
  }

  function handleReview() {
    router.push('/dna?entry=review');
  }

  async function handleResetDna() {
    if (typeof window !== 'undefined' && !window.confirm('Reset your Travel DNA? This clears all swipes and starts over.')) {
      return;
    }
    await resetDnaState();
    setDnaHint(DEFAULT_HINT);
  }

  // ---- Results list interactions ----

  // Tapping the month already being shown (whether that's the base month
  // or a previously-tapped alt month) toggles back to the base month;
  // tapping any other month just switches the preview to it. There's no
  // separate "open/closed" state to track — the card always shows exactly
  // one month's content, so this only ever needs to track which month.
  function handleToggleYearBar(destId: string, m: number) {
    const current = cardPreviewMonth[destId] || month;
    if (current === m) {
      setCardPreviewMonth((prev) => {
        const next = { ...prev };
        delete next[destId];
        return next;
      });
    } else {
      setCardPreviewMonth((prev) => ({ ...prev, [destId]: m }));
    }
  }

  function handleToggleBreakdown(destId: string) {
    setBreakdownExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(destId)) next.delete(destId);
      else next.add(destId);
      return next;
    });
  }

  function handleSelectSearchResult(destId: string) {
    const rankIdx = ranked.findIndex((r) => r.d.id === destId);
    if (rankIdx < 0) return;
    setVisibleCount((prev) => Math.max(prev, rankIdx + 1));
    setHighlightedId(destId);
  }

  useEffect(() => {
    if (!highlightedId) return;
    const el = cardRefs.current.get(highlightedId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightedId(null), 1700);
    return () => clearTimeout(t);
  }, [highlightedId]);

  // Puts the month panel itself flush at the top of the viewport — not
  // the results section below it. That's what pushes "Open To" and
  // everything above the month panel out of view, and leaves the most
  // possible room below for the results to actually show. The delay
  // gives any native "scroll the tapped button into view" behavior a
  // mobile browser applies on its own time to finish FIRST, so this runs
  // last and is the final word on where the page ends up — without it,
  // that native scroll can win and land on/around the tapped button
  // instead. Instant, not smooth: smooth-scroll animations proved
  // unreliable (silently not completing) in testing.
  useEffect(() => {
    if (!isFetchingResults) return;
    const t = setTimeout(() => {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const el = monthPanelRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
    }, 200);
    return () => clearTimeout(t);
  }, [isFetchingResults]);

  useEffect(() => {
    return () => {
      if (fetchingTimerRef.current) clearTimeout(fetchingTimerRef.current);
    };
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <span>🧭</span>
          <h1>Where To?</h1>
          <span className="app-header-tagline">Find your next trip, by what you actually want to do.</span>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <DnaPanel
            hintText={dnaHint}
            isDnaActive={isDnaActive}
            onUseTravelDNA={handleUseTravelDNA}
            onKeepRefining={handleKeepRefining}
            onReview={handleReview}
            onReset={handleResetDna}
          />
          <PersonaPicker activePersonaId={personaId} collapsed={personaId === null && hasStarted} onSelect={handleSelectPersona} />
          <SliderPanel
            weights={weights}
            onSliderChange={handleSliderChange}
            showAllSliders={showAllSliders}
            onToggleShowAll={handleToggleShowAll}
            activePersonaId={personaId}
            savedProfiles={savedProfiles}
            onSelectProfile={handleSelectProfile}
            onSaveProfile={handleSaveProfile}
            onDeleteProfile={handleDeleteProfile}
            onReset={handleResetSliders}
            earnedStyles={earnedStyles}
            selectedStyles={selectedStyles}
            onToggleStyle={handleToggleStyle}
          />
          <div className="panel">
            <h2>Open To</h2>
            <BandDimensionPicker bands={bands} onToggle={handleToggleBand} />
          </div>
          <div className="panel" ref={monthPanelRef}>
            <h2>When can you travel?</h2>
            <MonthGrid month={month} monthChosen={monthChosen} onChoose={handleChooseMonth} />
          </div>
          <div className="panel-note">
            Scores are built from general seasonal patterns, traveler-reported experiences, and public climate data — not
            live weather or pricing data. Treat rankings as a strong starting point, and double-check specifics before
            booking.
          </div>
        </aside>

        <section className="results">
          <h1 ref={resultsTopRef}>Recommendations</h1>
          {hasStarted && monthChosen && month && (
            <p className="results-subtitle">
              Ranked for {MONTH_NAMES[month - 1]}, by your current sliders — showing {Math.min(visibleCount, ranked.length)} of{' '}
              {ranked.length} destinations
            </p>
          )}

          {hasStarted && monthChosen && (
            <SearchBox destinations={destinations} ranked={ranked} onSelectResult={handleSelectSearchResult} />
          )}

          {isFetchingResults ? (
            <FetchingResults />
          ) : !hasStarted ? (
            <StartPrompt onStartSwiping={handleKeepRefining} />
          ) : !monthChosen || !month ? (
            <MonthPrompt />
          ) : (
            <ResultsList
              ranked={ranked}
              visibleCount={visibleCount}
              onShowMore={() => setVisibleCount((v) => v + 20)}
              weights={weights}
              month={month}
              bands={bands}
              selectedStyles={selectedStyles}
              breakdownExpanded={breakdownExpanded}
              cardPreviewMonth={cardPreviewMonth}
              onToggleYearBar={handleToggleYearBar}
              onToggleBreakdown={handleToggleBreakdown}
              highlightedId={highlightedId}
              cardRefs={cardRefs}
            />
          )}
        </section>
      </div>

      {hasStarted && monthChosen && month && !isFetchingResults && <BackToTopButton targetRef={resultsTopRef} />}
    </>
  );
}
