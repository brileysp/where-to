'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveUserPreferences } from '@/app/actions';
import { allBandsSelected } from '@/lib/scoring/constants';
import { saveTravelProfile } from '@/app/onboarding-v2/actions';
import { fromTravelProfile, toTravelProfile, type FlowChoices, type InterestAnswers, type TravelProfile } from '@/lib/onboarding/profile';
import { chooseNextCard } from '@/lib/dna/selection';
import type { DnaCard, SwipeType } from '@/lib/dna/types';
import { dnaStateFor, type Answer, type ProfileInput } from '@/lib/onboarding/bridge';
import { rankingMonth } from '@/lib/onboarding/shortlist';
import { startingInterests } from '@/lib/onboarding/vibe-interests';
import { DEFAULT_PEAK } from '@/lib/onboarding/peak';
import type { FlowData } from './FlowData';
import './onboarding-v2.css';
import { backTarget, buildPath, chooseDoor, emptyDoors, nextScreen, progressPercent, type DoorKey, type Doors, type FlowMode, type ScreenId } from '@/lib/onboarding/path';
import { getOnboardingSettings } from '@/lib/onboarding/settings';
import { pickerGroups, setInterestEmojiOverrides } from '@/lib/onboarding/interests';
import { orderedByLevel, setLevel, togglePick, toggleSpecific, toggleTop, type Levels } from '@/lib/onboarding/levels';
import { dnaRows, dnaTags, keepOn } from '@/lib/onboarding/dna-rows';
import { interestByKey } from '@/lib/onboarding/interests';
import { computeDisplayCalibrationPercent } from '@/lib/dna/calibration-feedback';
import { allBands, clearCare, setCareFirm, toggleBandChoice, toggleBandPill, toggleCareOption, toggleInList, resetBand, type Bands, type CareItem, type CareState } from '@/lib/onboarding/care';
import { useUnits } from '@/components/UnitsProvider';
import { loadMatchFits } from '@/app/onboarding-v2/actions';
import type { MatchFitsByInterest } from '@/lib/onboarding/live-factors';
import { ELSEWHERE, type HomeBundle } from './HomeLocation';
import { HOME_COUNTRIES } from '@/lib/onboarding/origin';
import type { TripLength } from '@/lib/onboarding/trip-length';
import type { RegionKey } from '@/lib/onboarding/regions';
import { effectiveTrip, type Trip } from '@/lib/onboarding/trips';
import { useTrips, type TripDefaults } from './live/useTrips';
import { TopBar } from './TopBar';
import { Toast } from './Toast';
import { TopLimitModal } from './TopLimitModal';
import { DoorScreen } from './screens/DoorScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { LoveScreen } from './screens/LoveScreen';
import { RankScreen } from './screens/RankScreen';
import { WhenScreen } from './screens/WhenScreen';
import { LogisticsScreen } from './screens/LogisticsScreen';
import { EssentialsScreen, type CareHandlers } from './screens/EssentialsScreen';
import { DnaBasicsScreen } from './screens/DnaBasicsScreen';
import { VibesScreen } from './screens/VibesScreen';
import { CardsScreen } from './screens/CardsScreen';
import { ShortlistScreen } from './screens/ShortlistScreen';
import { DnaPage } from './screens/DnaPage';
import { SavedScreen } from './screens/SavedScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

/**
 * The new onboarding flow (docs/onboarding-v2/SPEC.md). Built beside the old one, reached only through /onboarding-v2 while the switch
 * is on. Every screen is built; a returning traveler starts at the welcome (or, from "Review Travel DNA", at the Travel DNA page).
 */
export interface FlowEntry {
  /** What this traveler saved last time, or null for a new one. */
  saved: TravelProfile | null;
  /** First name, when the traveler has one on file. */
  name: string | null;
  /** True when opened from "Review Travel DNA": straight to the Travel DNA page. */
  review: boolean;
  /** Opened with ?fresh=1 (testing): the one-time lessons play again. */
  fresh: boolean;
  /** The traveler's saved trips, the most recently saved first. */
  trips: Trip[];
}

export function OnboardingV2Flow({ data, entry }: { data: FlowData; entry: FlowEntry }) {
  const router = useRouter();
  // The admin's emoji for each interest, applied before any screen reads an interest's icon (a state initializer runs once, ahead of the children).
  useState(() => setInterestEmojiOverrides(data.emojiOverrides));
  const chips = data.chips;
  // A returning traveler's choices from last time (answers whose card no longer exists are dropped).
  // The longest-flight question is gone (flights are worked out from where you live and the trip length), so a limit saved earlier no longer applies.
  const start: FlowChoices | null = useMemo(() => (entry.saved ? { ...fromTravelProfile(entry.saved, data.cards), maxHours: 0 } : null), [entry.saved, data.cards]);
  /** What the profile says for the choices a trip can change: the defaults every trip inherits. */
  const [defaults, setDefaults] = useState<TripDefaults>(() => ({ who: start?.who ?? [], bands: start?.bands ?? allBands(), care: start?.care ?? {}, peak: start?.peak ?? DEFAULT_PEAK }));
  // The most recently saved trip is the one open; its settings are laid over the profile's defaults.
  const openTrip = entry.trips[0] ?? null;
  const openEff = openTrip ? effectiveTrip(defaults, openTrip) : null;
  const [returning, setReturning] = useState(!!entry.saved);
  const [mode, setMode] = useState<FlowMode>('trip');
  const [doors, setDoors] = useState<Doors>(emptyDoors());
  const [screen, setScreen] = useState<ScreenId>(entry.saved ? (entry.review ? 'dnasum' : 'welcome') : 'door');
  const firstGroup = pickerGroups()[0].name;
  const [levels, setLevels] = useState<Levels>(start?.levels ?? {});
  const [subs, setSubs] = useState<Record<string, string[]>>(start?.subs ?? {});
  /** Answers to the interests' own questions (docs/matching-model.md), saved with the profile. */
  const [qa, setQa] = useState<InterestAnswers>(start?.qa ?? {});
  const [group, setGroup] = useState(firstGroup);
  const [seen, setSeen] = useState<Record<string, boolean>>({ [firstGroup]: true });
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [topPopup, setTopPopup] = useState(false);
  const [month, setMonth] = useState<number | null>(openTrip ? openTrip.month : (start?.month ?? null));
  const [week, setWeek] = useState(openTrip ? openTrip.week : (start?.week ?? 0));
  const [who, setWho] = useState<string[]>(openEff ? openEff.who : (start?.who ?? []));
  const [bands, setBands] = useState<Bands>(openEff ? openEff.bands : (start?.bands ?? allBands()));
  const [care, setCare] = useState<CareState>(openEff ? openEff.care : (start?.care ?? {}));
  const [careOpen, setCareOpen] = useState(false);
  const [careTiles, setCareTiles] = useState<string[]>([]);
  const { country: unitsCountry } = useUnits();
  // How places do for each picked interest's chips and answers, loaded as soon as the interests are known so the results never re-sort on arrival.
  const [fits, setFits] = useState<MatchFitsByInterest>({});
  const [home, setHome] = useState<string | null>(start?.home ?? null);
  // Where you live: the saved country, else the home country already set for units, if it is one we list.
  const [homeCountry, setHomeCountry] = useState<string | null>(start?.homeCountry ?? (HOME_COUNTRIES.some((c) => c[0] === unitsCountry) ? unitsCountry : null));
  const [homeSub, setHomeSub] = useState<string | null>(start?.homeSub ?? null);
  const [length, setLength] = useState<TripLength | null>(openTrip ? openTrip.length : (start?.length ?? null));
  const [continents, setContinents] = useState<RegionKey[]>(openTrip ? openTrip.continents : (start?.continents ?? []));
  const [maxHours, setMaxHours] = useState(start?.maxHours ?? 0);
  /** Peak or off peak (a step from 0 to 4, starting in the middle). */
  const [peak, setPeak] = useState(openEff ? openEff.peak : (start?.peak ?? DEFAULT_PEAK));
  const [toast, setToast] = useState<string | null>(null);
  const [vibes, setVibes] = useState<string[]>(start?.vibes ?? []);
  /** Taste-card swipes, and sharpen-question answers (kept apart: only sharpen answers count toward the unlock). */
  const [swipes, setSwipes] = useState<Answer[]>(start?.answers ?? []);
  const [sharpen, setSharpen] = useState<Answer[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [tasteCard, setTasteCard] = useState<DnaCard | null>(null);
  const [tasteCount, setTasteCount] = useState(0);
  const input: ProfileInput = useMemo(() => ({ levels, who, bands, vibes, answers: [...swipes, ...sharpen] }), [levels, who, bands, vibes, swipes, sharpen]);
  const tasteTotal = getOnboardingSettings().shortlistPlaces;
  /** The Travel DNA page: where it was opened from, which cards are open or closed, the order fixed on entry, "show all", and the keep switches. */
  const [dnaFrom, setDnaFrom] = useState<ScreenId | null>(null);
  /** The Travel DNA page open as a sheet over the results (it keeps the list where it is). */
  const [dnaSheet, setDnaSheet] = useState(false);
  const [dxo, setDxo] = useState<Record<string, boolean>>({});
  const [dsc, setDsc] = useState<Record<string, boolean>>({});
  const [dorder, setDorder] = useState<string[]>(() => (entry.review ? orderedByLevel(start?.levels ?? {}) : []));
  const [dall, setDall] = useState(false);
  const [keep, setKeep] = useState<Record<string, boolean>>({});

  // Saved trips: the screens work on one set of values; this keeps the list of trips, saves the open one, and loads another when switching.
  const tripWork = useMemo(() => ({ month, week, length, continents, who, bands, care, peak }), [month, week, length, continents, who, bands, care, peak]);
  const trips = useTrips({
    initial: entry.trips,
    first: entry.name,
    enabled: screen === 'results',
    work: tripWork,
    defaults,
    apply: (t, eff) => {
      setMonth(t.month);
      setWeek(t.week);
      setLength(t.length);
      setContinents(t.continents);
      setWho(eff.who);
      setBands(eff.bands);
      setCare(eff.care);
      setPeak(eff.peak);
    },
    toast: setToast,
  });

  /**
   * A traveler who picked no interests (photos only, or "surprise me") still gets the live questions: the interests their photos point to,
   * everyday ones only (never the specialist tier) and only those with questions, become their starting interests (as Like). Worked out when
   * the photos are left and again on the way to the results, until the traveler changes interests themselves.
   */
  const [autoLevels, setAutoLevels] = useState(false);
  function startingLevels(): Levels {
    const ok = (k: string) => (interestByKey(k)?.tier ?? 'specialist') !== 'specialist' && (data.setups[k]?.questions.length ?? 0) > 0;
    return Object.fromEntries(startingInterests(vibes, ok).map((k) => [k, 'like' as const]));
  }
  function go(next: ScreenId | null) {
    if (!next) return;
    if ((screen === 'vibes' || next === 'results') && (Object.keys(levels).length === 0 || autoLevels)) {
      const auto = startingLevels();
      if (Object.keys(auto).length) {
        setLevels(auto);
        setAutoLevels(true);
      }
    }
    if (next === 'cards' && !tasteCard) {
      setTasteCount(0);
      setTasteCard(chooseNextCard(dnaStateFor(input, data.dimensions), data.cards, data.domains));
    }
    if (next === 'dnasum' && screen !== 'dnasum') {
      setDorder(orderedByLevel(levels));
      setDall(false);
      setDxo({});
    }
    setScreen(next);
    window.scrollTo({ top: 0 });
  }
  function onContinue() {
    go(nextScreen(mode, doors, screen));
  }
  function onBack() {
    const t = backTarget(mode, doors, screen);
    if (t.kind === 'screen') go(t.screen);
    else if (t.kind === 'restart') {
      reset();
    }
  }
  function reset() {
    setMode('trip');
    setDoors(emptyDoors());
    setScreen('door');
    setLevels({});
    setAutoLevels(false);
    setSubs({});
    setQa({});
    setGroup(firstGroup);
    setSeen({ [firstGroup]: true });
    setMore({});
    setTopPopup(false);
    setMonth(null);
    setWeek(0);
    setWho([]);
    setBands(allBands());
    setCare({});
    setCareOpen(false);
    setCareTiles([]);
    setHome(null);
    setHomeSub(null);
    setLength(null);
    setContinents([]);
    setMaxHours(0);
    setPeak(DEFAULT_PEAK);
    setToast(null);
    setVibes([]);
    setSwipes([]);
    setSharpen([]);
    setSkipped([]);
    setTasteCard(null);
    setTasteCount(0);
    setDnaFrom(null);
    setDxo({});
    setDsc({});
    setDorder([]);
    setDall(false);
    setKeep({});
  }
  function careProps(scope: 'trip' | 'dna'): CareHandlers {
    return {
      scope,
      care,
      bands,
      open: careOpen,
      tiles: careTiles,
      kidsSuggested: who.includes('kids') && !care.kids,
      onOpen: () => setCareOpen((o) => !o),
      onTile: (k) => setCareTiles((t) => toggleInList(t, k)),
      onBandChoice: (dim, band) => setBands((b) => toggleBandChoice(b, dim, band)),
      onBandReset: (dim) => setBands((b) => resetBand(b, dim)),
      onOption: (item: CareItem, option) => setCare((c) => toggleCareOption(c, item, option)),
      onFirm: (k, firm) => setCare((c) => setCareFirm(c, k, firm)),
      onClear: (k) => setCare((c) => clearCare(c, k)),
      onAddKids: () => {
        setCareOpen(true);
        setCareTiles((t) => (t.includes('kids') ? t : [...t, 'kids']));
      },
    };
  }
  function onDnaFirst() {
    reset();
    setMode('dna');
    setScreen('love');
  }
  function onTasteAnswer(type: SwipeType) {
    if (!tasteCard) return;
    const next = [...swipes, { card: tasteCard, type }];
    setSwipes(next);
    const n = tasteCount + 1;
    setTasteCount(n);
    setTasteCard(n >= tasteTotal ? null : chooseNextCard(dnaStateFor({ ...input, answers: [...next, ...sharpen] }, data.dimensions), data.cards, data.domains));
  }
  function openDnaSheet() {
    setDorder(orderedByLevel(levels));
    setDall(false);
    setDxo({});
    setDnaSheet(true);
  }
  function onDnaLevel(key: string, level: Parameters<typeof setLevel>[2]) {
    const r = setLevel(levels, key, level);
    if (r.blocked) {
      setTopPopup(true);
      return;
    }
    setAutoLevels(false);
    setLevels(r.levels);
    setTopPopup(false);
    setDxo((o) => ({ ...o, [`i:${key}`]: r.open }));
  }
  /** What would be saved right now, and the save itself. */
  function choices(): FlowChoices {
    return { levels, subs, qa, bands, care, who, home, homeCountry: homeCountry === ELSEWHERE ? null : homeCountry, homeSub, vibes, answers: [...swipes, ...sharpen], month, week, length, continents, maxHours, peak };
  }
  async function persist(): Promise<boolean> {
    const profile = toTravelProfile(choices(), keep, mode === 'dna');
    const r = await saveTravelProfile(profile);
    if (!r.ok) setToast('Could not save. Try again.');
    else setDefaults({ who: profile.who, bands: profile.bands, care: profile.care, peak: profile.peak });
    return r.ok;
  }
  async function onDnaSave() {
    if (!(await persist())) return;
    if (entry.review && !dnaFrom) {
      router.push('/');
      return;
    }
    if (dnaFrom) {
      const f = dnaFrom;
      setDnaFrom(null);
      go(f);
      setToast('Travel DNA saved');
    } else go('saved');
  }
  /** The saved screen's "See it as a returning traveler": only what was kept carries over, then the two questions. */
  function seeAsReturning() {
    const kept = fromTravelProfile(toTravelProfile(choices(), keep, mode === 'dna'), data.cards);
    setQa(kept.qa ?? {});
    setWho(kept.who);
    setBands(kept.bands);
    setCare(kept.care);
    setHome(kept.home);
    setHomeCountry(kept.homeCountry ?? null);
    setHomeSub(kept.homeSub ?? null);
    setLength(kept.length ?? null);
    setContinents(kept.continents ?? []);
    setVibes(kept.vibes);
    setSwipes(kept.answers);
    setSharpen([]);
    setSkipped([]);
    setMonth(kept.month);
    setWeek(kept.week);
    setMaxHours(kept.maxHours);
    setPeak(kept.peak ?? DEFAULT_PEAK);
    setMode('trip');
    setReturning(true);
    go('welcome');
  }
  function onDnaSecondary() {
    if (mode === 'dna') {
      setMonth(null);
      go('results');
    } else onDnaBack();
  }
  function onDnaBack() {
    if (entry.review && !dnaFrom) {
      router.push('/');
      return;
    }
    if (dnaFrom) {
      const f = dnaFrom;
      setDnaFrom(null);
      go(f);
    } else onBack();
  }
  const rowCtx = { dnaMode: mode === 'dna', bands, care, who, home, homeCountry: homeCountry === ELSEWHERE ? null : homeCountry, homeSub, vibes, answerCount: input.answers.length, month, week, length, continents, maxHours };
  const loc: HomeBundle = {
    country: homeCountry,
    sub: homeSub,
    airport: home,
    onCountry: (c) => {
      setHomeCountry(c);
      setHomeSub(null);
      setHome(null);
    },
    onSub: (c) => {
      setHomeSub(c || null);
      setHome(null);
    },
    onPickAirport: setHome,
    onClearAirport: () => setHome(null),
  };
  async function onSeeAll(weights: Record<string, number>) {
    // The full results page reads what is saved, so the whole profile goes first (it also records the Travel DNA the page shows), then the
    // exact weights and month this shortlist was ranked with, so the list there opens the same way.
    if (!(await persist())) return;
    await saveUserPreferences({ personaId: null, weights, bands: { ...allBandsSelected(), ...bands }, month: rankingMonth(month), monthChosen: true, showAllSliders: true });
    router.push('/');
  }
  function openGroup(g: string, scrollTop?: boolean) {
    setGroup(g);
    setSeen((s) => ({ ...s, [g]: true }));
    if (scrollTop) window.scrollTo({ top: 0 });
  }
  function onStar(key: string) {
    const r = toggleTop(levels, key);
    setAutoLevels(false);
    setLevels(r.levels);
    setTopPopup(r.blocked);
  }

  /** The Travel DNA page as an element: the full screen, or the sheet over the results. */
  const renderDna = (h: { onSave: () => void; onSecondary: () => void; onBack: () => void }) => (
      <DnaPage
        data={data}
        dnaMode={mode === 'dna'}
        input={input}
        levels={levels}
        subs={subs}
        bands={bands}
        care={care}
        who={who}
        home={home}
        vibes={vibes}
        month={month}
        week={week}
        maxHours={maxHours}
        order={dorder}
        open={dxo}
        collapsed={dsc}
        showAll={dall}
        keep={keep}
        onLevel={onDnaLevel}
        onSpecific={(i, c) => setSubs((s) => toggleSpecific(s, i, c))}
        onToggleOpen={(k, cur) => setDxo((o) => ({ ...o, [k]: !cur }))}
        onToggleBlock={(k) => setDsc((c) => ({ ...c, [k]: !c[k] }))}
        onShowAll={() => setDall((a) => !a)}
        onKeep={(k, def) => setKeep((m) => ({ ...m, [k]: !keepOn(m, k, def) }))}
        onBandPill={(d, b) => setBands((x) => toggleBandPill(x, d, b))}
        onBandChoice={(d, b) => setBands((x) => toggleBandChoice(x, d, b))}
        onCareOption={(item, o) => setCare((c) => toggleCareOption(c, item, o, true))}
        onCareFirm={(k, f) => setCare((c) => setCareFirm(c, k, f))}
        onWho={(k) => setWho((w) => toggleInList(w, k))}
        loc={loc}
        length={length}
        continents={continents}
        onLength={setLength}
        onContinents={setContinents}
        onMaxHours={setMaxHours}
        onNeedHome={() => setToast('Choose where you live first')}
        onVibe={(k) => setVibes((v) => toggleInList(v, k))}
        onMonth={setMonth}
        {...h}
                      />
  );

  const fitKeys = Object.keys(levels).filter((k) => data.setups[k]);
  const fitSig = fitKeys.join('|');
  useEffect(() => {
    const need = fitKeys.filter((k) => !fits[k]);
    if (!need.length) return;
    let live = true;
    loadMatchFits(need).then((r) => { if (live) setFits((f) => ({ ...f, ...r })); }).catch(() => {});
    return () => { live = false; };
  }, [fitSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // The shortlist opens only once how places do for the traveler's interests has arrived, so the list never re-sorts by itself. If it is slow, show it anyway after a few seconds.
  const fitsPending = fitKeys.some((k) => !fits[k]);
  const [fitsGiveUp, setFitsGiveUp] = useState(false);
  useEffect(() => {
    if (screen !== 'results' || !fitsPending) return;
    const t = setTimeout(() => setFitsGiveUp(true), 5000);
    return () => clearTimeout(t);
  }, [screen, fitsPending]);
  const waitingForFits = screen === 'results' && fitsPending && !fitsGiveUp;

  const hasBack = backTarget(mode, doors, screen).kind !== 'none';

  return (
    <div className="ob2">
      <div className="ob2-phone">
        {screen !== 'results' && screen !== 'dnasum' && screen !== 'welcome' && <TopBar onBack={hasBack ? onBack : undefined} percent={progressPercent(mode, doors, screen)} />}
        {mode === 'dna' && <div className="ob2-mb">Building your Travel DNA · no trip needed · about a minute</div>}
        {screen === 'door' ? (
          <DoorScreen doors={doors} onChoose={(k: DoorKey) => setDoors((d) => chooseDoor(d, k))} onContinue={onContinue} onDnaFirst={onDnaFirst} />
        ) : screen === 'love' ? (
          <LoveScreen
            levels={levels}
            group={group}
            seen={seen}
            more={more}
            dnaMode={mode === 'dna'}
            onToggle={(k) => { setAutoLevels(false); setLevels((l) => togglePick(l, k)); }}
            onGroup={openGroup}
            onMore={(g) => setMore((m) => ({ ...m, [g]: !m[g] }))}
            onSkip={() => {
              setLevels({});
              go('essentials');
            }}
            onContinue={onContinue}
          />
        ) : screen === 'rank' ? (
          <RankScreen levels={levels} chips={chips} subs={subs} onStar={onStar} onSpecific={(i, c) => setSubs((s) => toggleSpecific(s, i, c))} onContinue={onContinue} onBack={onBack} />
        ) : screen === 'when' ? (
          <WhenScreen month={month} week={week} length={length} windowMode={doors.window} onMonth={(m) => setMonth(m)} onWeek={setWeek} onLength={setLength} onContinue={onContinue} />
        ) : screen === 'logistics' ? (
          <LogisticsScreen loc={loc} onContinue={onContinue} />
        ) : screen === 'essentials' ? (
          <EssentialsScreen who={who} bands={bands} continents={continents} peak={peak} onPeak={setPeak} onWho={(k) => setWho((w) => toggleInList(w, k))} onBand={(d, b) => setBands((x) => toggleBandPill(x, d, b))} onContinents={setContinents} careProps={careProps('trip')} onContinue={onContinue} />
        ) : screen === 'dnabasics' ? (
          <DnaBasicsScreen
            who={who}
            bands={bands}
            loc={loc}
            onWho={(k) => setWho((w) => toggleInList(w, k))}
            onBand={(d, b) => setBands((x) => toggleBandPill(x, d, b))}
            careProps={careProps('dna')}
            onContinue={onContinue}
          />
        ) : screen === 'vibes' ? (
          <VibesScreen picked={vibes} onToggle={(k) => setVibes((v) => toggleInList(v, k))} onContinue={onContinue} />
        ) : screen === 'cards' ? (
          <CardsScreen card={tasteCard} done={tasteCount >= tasteTotal} index={tasteCount} total={tasteTotal} onAnswer={onTasteAnswer} onContinue={onContinue} />
        ) : screen === 'results' && waitingForFits ? (
          <div className="ob2-scr"><p className="ob2-sub" role="status">Finding your places…</p></div>
        ) : screen === 'results' ? (
          <ShortlistScreen
            data={data}
            input={input}
            sharpenAnswered={sharpen.length}
            seenCardIds={skipped}
            sharpenCardIds={sharpen.map((a) => a.card.id)}
            month={month}
            week={week}
            who={who}
            bands={bands}
            home={home}
            maxHours={maxHours}
            peak={peak}
            onPeak={setPeak}
            careProps={careProps('trip')}
            returning={returning}
            levels={levels}
            trips={trips}
            fits={fits}
            fresh={entry.fresh}
            subs={subs}
            qa={qa}
            onAnswer={(interest, qkey, picks) => setQa((a) => ({ ...a, [interest]: { ...(a[interest] ?? {}), [qkey]: picks } }))}
            onTick={(interest, chip) => setSubs((x) => toggleSpecific(x, interest, chip))}
            onAddInterest={(k) => { setAutoLevels(false); setLevels((l) => (l[k] ? l : { ...l, [k]: 'like' })); }}
            onRemoveInterest={(k) => { setAutoLevels(false); setLevels((l) => { const n = { ...l }; delete n[k]; return n; }); }}
            onSharpenAnswer={(card, type) => setSharpen((a) => [...a, { card, type }])}
            onSharpenSkip={(card) => setSkipped((s) => [...s, card.id])}
            onSwipe={(card, type) => setSwipes((a) => [...a, { card, type }])}
            onWho={(k) => setWho((w) => toggleInList(w, k))}
            onBandPill={(d, b) => setBands((x) => toggleBandPill(x, d, b))}
            onMonth={setMonth}
            onWeek={setWeek}
            loc={loc}
            length={length}
            continents={continents}
            onLength={setLength}
            onContinents={setContinents}
            onMaxHours={setMaxHours}
            onNeedHome={() => setToast('Choose where you live first')}
            onSeeAll={onSeeAll}
            onSave={openDnaSheet}
            onDna={openDnaSheet}
            onCloseDna={() => setDnaSheet(false)}
            dnaSheet={dnaSheet ? renderDna({ onSave: async () => { if (await persist()) { setDnaSheet(false); setToast('Travel DNA saved'); } }, onSecondary: () => setDnaSheet(false), onBack: () => setDnaSheet(false) }) : null}
            toast={setToast}
          />
        ) : screen === 'dnasum' ? (
          renderDna({ onSave: onDnaSave, onSecondary: onDnaSecondary, onBack: onDnaBack })
        ) : screen === 'saved' ? (
          <SavedScreen
            tags={dnaTags({ bands, care, vibes, levels, subs, chips, interestOrder: orderedByLevel(levels), interestName: (k) => interestByKey(k) ?? { icon: '•', label: k } })}
            calibration={Math.round(computeDisplayCalibrationPercent(dnaStateFor(input, data.dimensions), data.cards))}
            rows={dnaRows(rowCtx)}
            keep={keep}
            onReturning={seeAsReturning}
            onBack={() => go('results')}
          />
        ) : screen === 'welcome' ? (
          <WelcomeScreen
            name={entry.name}
            tags={dnaTags({ bands, care, vibes, levels, subs, chips, interestOrder: orderedByLevel(levels), interestName: (k) => interestByKey(k) ?? { icon: '•', label: k } })}
            month={month}
            who={who}
            onMonth={setMonth}
            onWho={(k) => setWho((w) => toggleInList(w, k))}
            onContinue={() => go('results')}
          />
        ) : (
          <PlaceholderScreen screen={screen} path={buildPath(mode, doors)} onContinue={onContinue} />
        )}
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {topPopup && <TopLimitModal max={getOnboardingSettings().maxTopInterests} onClose={() => setTopPopup(false)} />}
    </div>
  );
}
