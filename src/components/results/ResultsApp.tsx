'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERSONAS, SLIDERS, allBandsSelected } from '@/lib/scoring/constants';
import { computeRankedDestinations } from '@/lib/scoring/rank';
import { topInterestChips } from '@/lib/scoring/breakdown';
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
import { ResultsHeader } from './ResultsHeader';
import { useResortDemo, prefersReducedMotion } from './useResortDemo';
import { ResultsList } from './ResultsList';
import { DnaPanel } from './DnaPanel';
import { BackToTopButton } from './BackToTopButton';
import { DestinationDetailSheet } from './DestinationDetailSheet';
import { InterestChip, shortInterestLabel } from './InterestChip';
import { StampsSheet } from './StampsSheet';
import { VisitedCounterStamp } from './VisitedCounterStamp';
import { BookmarkIcon } from './BookmarkIcon';
import './results.css';

const DEFAULT_HINT = 'Swipe through experiences to teach Where To? your travel style.';
const RESET_CONFIRM = "Reset sliders and Open To bands to the current persona's defaults?";
// Ranking is actually instant (client-side, synchronous) — this is a
// purely perceptual delay so picking a month doesn't feel suspiciously
// fast, like nothing happened. Real work still finishes well under it.
// Kept comfortably longer than the scroll-into-view animation below so
// the fetching state is still on screen once that scroll settles.
const FETCHING_RESULTS_MS = 900;

// The first-appearance entrance, timed from the moment the fetching state
// resolves (see handleChooseMonth / revealStage above) — mirrors the "Place
// Card Open" mockup's timing: a beat for "My Interests" to pop open, then
// the cards rise into place.
const REVEAL_MY_INTERESTS_MS = 350;
const REVEAL_CARDS_MS = 550;

function weightsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  return SLIDERS.every((s) => (a[s.key] || 0) === (b[s.key] || 0));
}

interface Props {
  destinations: ScoredDestination[];
  initialPreferences: LoadedUserPreferences | null;
  initialSavedProfiles: SavedProfileData[];
  initialDnaHint: string;
  initialHasDnaSignal: boolean;
  /** First word of the visitor's stored name, or null — the header says "you" for null. */
  userFirstName: string | null;
  /** Admin-set emoji overrides, keyed by slider key — see getInterestEmojiOverrides. Falls back to the slider's own code-defined icon when a key has no override. */
  emojiOverrides: Record<string, string>;
}

export function ResultsApp({ destinations, initialPreferences, initialSavedProfiles, initialDnaHint, initialHasDnaSignal, userFirstName, emojiOverrides }: Props) {
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
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isFetchingResults, setIsFetchingResults] = useState(false);
  // The first-appearance entrance (see handleChooseMonth): 0 = chips bare,
  // cards hidden; 1 = "My Interests" has popped open; 2 = settled, cards
  // risen into place. Starts at 2 (nothing to play) so a returning visitor
  // whose month was already chosen in a prior session lands on a normal,
  // already-settled list instead of replaying this every load.
  const [revealStage, setRevealStage] = useState<0 | 1 | 2>(2);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // "Visited" is deliberately ephemeral — no user_stamps table exists yet
  // (see docs/final-architecture-plan.md's Place-migration Phase 1). This
  // resets every page load; it becomes real persistence once that schema
  // work happens, without changing anything about this UI.
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  // Same ephemeral treatment as `visited` — no favorites table exists yet,
  // this resets every page load until that becomes real persisted data.
  const [favorited, setFavorited] = useState<Record<string, boolean>>({});
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);
  const [showStamps, setShowStamps] = useState(false);
  const [hideVisited, setHideVisited] = useState(false);
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);
  // null = "Overall" (the sidebar's full weighted ranking, unchanged).
  // Otherwise a slider key — a quick, display-only re-sort of `ranked` by
  // that one slider's score for the current month. Never touches `weights`
  // or triggers a new computeRankedDestinations call.
  const [pinnedChip, setPinnedChip] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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
  const resultsRef = useRef<HTMLElement>(null);
  const chipRowRef = useRef<HTMLDivElement>(null);
  const chipEls = useRef<Map<string, HTMLElement>>(new Map());

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

  // Overall + your top interests — the exact same topInterestChips list the
  // detail sheet's For You tab shows (same pool, same adaptive 1-5 count),
  // so a chip that appears on a place card was never hidden up here.
  const chipSliders = useMemo(() => topInterestChips(weights), [weights]);

  // A pinned chip re-sorts a copy of `ranked` by that one slider's own
  // score for the current month (not the overall weighted score) — display-
  // only, never feeds back into `weights` or triggers a new ranking
  // computation. The displayed `s` is swapped to that same interest-specific
  // score too, so the number on each tile always matches what it's sorted
  // by; ties fall back to the destination's original overall score/order.
  const displayRanked = useMemo(() => {
    let list = ranked;
    if (hideVisited) list = list.filter((r) => !visited[r.d.id]);
    if (showWishlistOnly) list = list.filter((r) => favorited[r.d.id]);
    if (pinnedChip && month) {
      const monthIdx = month - 1;
      list = list
        .map((r) => ({ d: r.d, s: r.d.monthly[pinnedChip]?.[monthIdx] ?? 0, overall: r.s }))
        .sort((a, b) => b.s - a.s || b.overall - a.overall)
        .map(({ d, s }) => ({ d, s }));
    }
    return list;
  }, [ranked, hideVisited, visited, showWishlistOnly, favorited, pinnedChip, month]);

  const resultsShown = hasStarted && monthChosen && !!month;

  // First-visit walkthrough of the chip re-sort — see useResortDemo.
  const demo = useResortDemo({
    ready: resultsShown && !isFetchingResults && displayRanked.length > 0 && !openDetailId,
    chipKeys: chipSliders.map((s) => s.key),
    pinChip: setPinnedChip,
    containerRef: resultsRef,
    chipRowRef,
    chipEls,
    cardRefs,
    rowIds: () => displayRanked.map((r) => r.d.id),
  });

  const openDetailEntry = openDetailId ? ranked.find((r) => r.d.id === openDetailId) : undefined;
  const visitedCount = Object.values(visited).filter(Boolean).length;
  const favoritedCount = Object.values(favorited).filter(Boolean).length;

  function toggleVisited(id: string) {
    setVisited((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleFavorited(id: string) {
    setFavorited((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
    // A chip pinned under the old weights may not even exist in the new
    // persona's top set — left as-is, nothing in the row would match it, so
    // no chip (not even "My Interests") would show as selected. A fresh
    // profile always starts back on the unfiltered "My Interests" view.
    setPinnedChip(null);
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
    const reduced = prefersReducedMotion();
    if (!reduced) setRevealStage(0);
    if (fetchingTimerRef.current) clearTimeout(fetchingTimerRef.current);
    revealTimersRef.current.forEach(clearTimeout);
    fetchingTimerRef.current = setTimeout(() => {
      setIsFetchingResults(false);
      // The entrance itself: "My Interests" pops open first, then the cards
      // rise into place a beat later — see the "Place Card Open" mockup.
      if (!reduced) {
        revealTimersRef.current = [
          setTimeout(() => setRevealStage(1), REVEAL_MY_INTERESTS_MS),
          setTimeout(() => setRevealStage(2), REVEAL_CARDS_MS),
        ];
      }
    }, FETCHING_RESULTS_MS);
  }

  // From the results header: the ranking simply re-sorts (and animates) in
  // place, so unlike the sidebar picker there's no "fetching" beat and no
  // scroll away from where the user is looking.
  function handleChangeMonthFromHeader(m: number) {
    setMonth(m);
    setVisibleCount(20);
    persist({ personaId, weights, bands, month: m, monthChosen: true, showAllSliders });
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
    setPinnedChip(null); // see handleSelectPersona's comment — same reset-the-whole-profile case
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
    setPinnedChip(null); // see handleSelectPersona's comment
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
    setPinnedChip(null); // see handleSelectPersona's comment
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
      revealTimersRef.current.forEach(clearTimeout);
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
            emojiOverrides={emojiOverrides}
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

        <section className="results" ref={resultsRef}>
          <div className={`resort-callout${demo.calloutVisible ? ' show' : ''}`} aria-hidden={!demo.calloutVisible}>
            <span className="resort-callout-icon">👆</span>Tap any interest to re-sort your results
          </div>

          {resultsShown && month ? (
            <ResultsHeader
              firstName={userFirstName}
              month={month}
              onChangeMonth={handleChangeMonthFromHeader}
              searchOpen={searchOpen}
              onToggleSearch={() => setSearchOpen((o) => !o)}
              titleRef={resultsTopRef}
            />
          ) : (
            <div className="results-heading-row">
              <h1 ref={resultsTopRef}>Recommendations</h1>
            </div>
          )}

          {resultsShown && (
            <SearchBox destinations={destinations} ranked={ranked} onSelectResult={handleSelectSearchResult} expanded={searchOpen} />
          )}

          {resultsShown && (
            <p className="results-subtitle">
              Ranked by your current sliders — showing {Math.min(visibleCount, displayRanked.length)} of {displayRanked.length} destinations
            </p>
          )}

          {resultsShown && (
            <div className="quick-chip-row-wrap">
              <div className="quick-chip-row" ref={chipRowRef}>
                <InterestChip emoji="🧬" label="My Interests" active={revealStage >= 1 && pinnedChip === null} onClick={() => setPinnedChip(null)} />
                {chipSliders.map((s) => (
                  <InterestChip
                    key={s.key}
                    emoji={emojiOverrides[s.key] ?? s.icon}
                    label={shortInterestLabel(s.label)}
                    fullLabel={s.label}
                    active={revealStage >= 1 && pinnedChip === s.key}
                    onClick={() => setPinnedChip(s.key)}
                    chipRef={(el) => {
                      if (el) chipEls.current.set(s.key, el);
                      else chipEls.current.delete(s.key);
                    }}
                  />
                ))}
              </div>
              <div className="quick-chip-row-fade" aria-hidden />
            </div>
          )}

          {resultsShown && (
            <div className="results-stats-row">
              <button type="button" className="visited-stat-btn" onClick={() => setShowStamps(true)}>
                <VisitedCounterStamp count={visitedCount} size={34} />
                <span className="visited-stat-label">places visited</span>
                <span className="visited-stat-chevron">›</span>
              </button>
              <button
                type="button"
                className={`filter-link${visitedCount === 0 ? ' empty' : hideVisited ? ' on' : ''}`}
                onClick={() => setHideVisited((v) => !v)}
                disabled={visitedCount === 0}
              >
                Hide visited
                <span className="filter-icon">{visitedCount > 0 && hideVisited ? '✓' : ''}</span>
              </button>
              <button
                type="button"
                className={`filter-link${favoritedCount === 0 ? ' empty' : showWishlistOnly ? ' wishlist-on' : ''}`}
                onClick={() => setShowWishlistOnly((v) => !v)}
                disabled={favoritedCount === 0}
              >
                Show saved
                <span className="filter-icon">
                  <BookmarkIcon filled={showWishlistOnly} />
                </span>
              </button>
            </div>
          )}

          <div
            className="resort-cursor"
            aria-hidden
            style={{
              left: demo.cursor.left,
              top: demo.cursor.top,
              opacity: demo.cursor.visible ? 1 : 0,
              transform: `translate(-50%, -50%) scale(${demo.cursor.pressed ? 0.65 : 1})`,
            }}
          />

          {isFetchingResults ? (
            <FetchingResults />
          ) : !hasStarted ? (
            <StartPrompt onStartSwiping={handleKeepRefining} />
          ) : !monthChosen || !month ? (
            <MonthPrompt />
          ) : (
            <ResultsList
              ranked={displayRanked}
              visibleCount={visibleCount}
              onShowMore={() => setVisibleCount((v) => v + 20)}
              highlightedId={highlightedId}
              cardRefs={cardRefs}
              visited={visited}
              favorited={favorited}
              onOpenDetail={setOpenDetailId}
              onToggleFavorited={toggleFavorited}
              onToggleVisited={toggleVisited}
              filterKey={`${hideVisited}:${showWishlistOnly}`}
              cardsRevealed={revealStage >= 2}
            />
          )}
        </section>
      </div>

      {openDetailEntry && month && (
        <DestinationDetailSheet
          key={openDetailEntry.d.id}
          dest={openDetailEntry.d}
          weights={weights}
          emojiOverrides={emojiOverrides}
          bands={bands}
          selectedStyles={selectedStyles}
          month={month}
          visited={!!visited[openDetailEntry.d.id]}
          onToggleVisited={() => toggleVisited(openDetailEntry.d.id)}
          favorited={!!favorited[openDetailEntry.d.id]}
          onToggleFavorited={() => toggleFavorited(openDetailEntry.d.id)}
          onClose={() => setOpenDetailId(null)}
        />
      )}

      {showStamps && (
        <StampsSheet destinations={destinations} visited={visited} onToggleVisited={toggleVisited} onClose={() => setShowStamps(false)} />
      )}

      {hasStarted && monthChosen && month && !isFetchingResults && <BackToTopButton targetRef={resultsTopRef} />}
    </>
  );
}
