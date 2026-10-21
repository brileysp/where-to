import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResultsList } from '@/components/results/ResultsList';
import { DestinationDetailSheet } from '@/components/results/DestinationDetailSheet';
import '@/components/results/results.css';
import { computeDisplayCalibrationPercent } from '@/lib/dna/calibration-feedback';
import { chooseNextCard } from '@/lib/dna/selection';
import type { DnaCard, SwipeType } from '@/lib/dna/types';
import { BAND_DIMENSIONS } from '@/lib/scoring/constants';
import { airportByCode } from '@/lib/onboarding/airports';
import { dnaStateFor, weightsFor, type Answer, type ProfileInput } from '@/lib/onboarding/bridge';
import { COMPANIONS, careCount, isNarrowed, type Bands } from '@/lib/onboarding/care';
import { answerMessage, isShortlistLocked, questionsToUnlock } from '@/lib/onboarding/lock';
import { pickQuestion } from '@/lib/onboarding/questions';
import { applyFlightLimit, rankPlaces } from '@/lib/onboarding/shortlist';
import { getOnboardingSettings } from '@/lib/onboarding/settings';
import type { FlowData } from '../FlowData';
import { interestByKey } from '@/lib/onboarding/interests';
import type { Levels } from '@/lib/onboarding/levels';
import type { InterestAnswers } from '@/lib/onboarding/profile';
import type { LiveItem } from '@/lib/onboarding/live-questions';
import { liveMatch, type MatchFitsByInterest } from '@/lib/onboarding/live-factors';
import { loadMatchFits } from '@/app/onboarding-v2/actions';
import { useLiveFlow } from '../live/useLiveFlow';
import { OPEN_LOCK, QuestionBox } from '../live/QuestionBox';
import { Teaser } from '../live/Teaser';
import { Sheet } from '../Sheet';
import { SharpenCard } from '../SharpenCard';
import { TasteCard } from '../TasteCard';
import { OpenToCard } from '../OpenToCard';
import { CareAccordion } from '../CareAccordion';
import { HomePicker } from '../HomePicker';
import type { CareHandlers } from './EssentialsScreen';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKS = ['Any week', 'Week 1', 'Week 2', 'Week 3', 'Week 4'];

type SheetId = 'who' | 'when' | 'care' | 'bands' | 'limits' | 'aside' | 'swipe' | null;

export interface ShortlistProps {
  data: FlowData;
  input: ProfileInput;
  /** Taste-card swipes and sharpen answers kept apart: only sharpen answers count toward the unlock. */
  sharpenAnswered: number;
  seenCardIds: string[];
  /** The cards answered in the question step so far, with the skipped ones in seenCardIds: what the grouped questions count. */
  sharpenCardIds: string[];
  month: number | null;
  week: number;
  who: string[];
  bands: Bands;
  home: string | null;
  maxHours: number;
  careProps: CareHandlers;
  returning: boolean;
  /** The live questions (docs/matching-model.md): what the traveler picked, ticked and answered, and how to change it. */
  levels: Levels;
  subs: Record<string, string[]>;
  qa: InterestAnswers;
  onAnswer: (interest: string, questionKey: string, picks: number[]) => void;
  onTick: (interest: string, chip: string) => void;
  onAddInterest: (interest: string) => void;
  onRemoveInterest: (interest: string) => void;
  onSharpenAnswer: (card: DnaCard, type: SwipeType) => void;
  onSharpenSkip: (card: DnaCard) => void;
  onSwipe: (card: DnaCard, type: SwipeType) => void;
  onWho: (k: string) => void;
  onBandPill: (dim: string, band: string) => void;
  onMonth: (m: number) => void;
  onWeek: (w: number) => void;
  onPickHome: (code: string) => void;
  onClearHome: () => void;
  onMaxHours: (h: number) => void;
  onNeedHome: () => void;
  onSeeAll: (weights: Record<string, number>) => void;
  onSave: () => void;
  onDna: () => void;
  toast: (msg: string) => void;
}

export function ShortlistScreen(p: ShortlistProps) {
  const { data, input } = p;
  const settings = getOnboardingSettings();
  const [sheet, setSheet] = useState<SheetId>(null);
  const [showAside, setShowAside] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [favorited, setFavorited] = useState<Record<string, boolean>>({});
  const [swipeCard, setSwipeCard] = useState<DnaCard | null>(null);
  const [swipeCount, setSwipeCount] = useState(0);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const weights = useMemo(() => weightsFor(input), [input]);

  // How each place does for the chips and answers of the interests the traveler has (loaded once per interest, small).
  const [fits, setFits] = useState<MatchFitsByInterest>({});
  const interestKeys = useMemo(() => Object.keys(p.levels).filter((k) => data.setups[k]), [p.levels, data.setups]);
  const interestSig = interestKeys.join('|');
  useEffect(() => {
    const need = interestKeys.filter((k) => !fits[k]);
    if (!need.length) return;
    let live = true;
    loadMatchFits(need).then((r) => { if (live) setFits((f) => ({ ...f, ...r })); }).catch(() => {});
    return () => { live = false; };
  }, [interestSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const match = useMemo(() => liveMatch({ interests: interestKeys, setups: data.setups, fits, ticked: p.subs, qa: p.qa, settings: data.matchSettings }), [interestKeys, data.setups, fits, p.subs, p.qa, data.matchSettings]);
  const rankedAll = useMemo(() => rankPlaces(data.destinations, weights, p.month, p.bands, match.factors), [data.destinations, weights, p.month, p.bands, match.factors]);
  const limited = useMemo(() => applyFlightLimit(rankedAll, p.home, p.maxHours, data.coords), [rankedAll, p.home, p.maxHours, data.coords]);

  /** The places that would be kept (best first) if the traveler's answers were these. */
  const keptWith = useCallback(
    (nextQa: InterestAnswers) => {
      const m = liveMatch({ interests: interestKeys, setups: data.setups, fits, ticked: p.subs, qa: nextQa, settings: data.matchSettings });
      return applyFlightLimit(rankPlaces(data.destinations, weights, p.month, p.bands, m.factors), p.home, p.maxHours, data.coords).kept;
    },
    [interestKeys, data.setups, data.destinations, data.matchSettings, data.coords, fits, p.subs, weights, p.month, p.bands, p.home, p.maxHours],
  );
  const withAnswer = (interest: string, qkey: string, picks: number[]): InterestAnswers => ({ ...p.qa, [interest]: { ...(p.qa[interest] ?? {}), [qkey]: picks } });
  const nameOf = (k: string) => ({ icon: data.emojiOverrides[k] ?? interestByKey(k)?.icon ?? '•', label: interestByKey(k)?.label ?? k });

  function describeMove(interest: string, qkey: string, picks: number[]): string | null {
    const before = limited.kept.slice(0, 10).map((r) => r.d.id);
    const after = keptWith(withAnswer(interest, qkey, picks)).slice(0, 5);
    let best: { name: string; by: number } | null = null;
    after.forEach((r, i) => {
      const was = before.indexOf(r.d.id);
      const by = was - i;
      if (was < 0 || by === 0) return;
      if (!best || Math.abs(by) > Math.abs(best.by)) best = { name: r.d.name, by };
    });
    const b = best as { name: string; by: number } | null;
    return b ? `${b.name} moved ${b.by > 0 ? 'up' : 'down'} ${Math.abs(b.by)}` : null;
  }

  const marks = Object.values(visited).filter(Boolean).length + Object.values(favorited).filter(Boolean).length;
  const live = useLiveFlow({
    setups: data.setups,
    levels: p.levels,
    subs: p.subs,
    qa: p.qa,
    chips: data.chips,
    returning: p.returning,
    marks,
    onAnswer: p.onAnswer,
    onTick: p.onTick,
    onAddInterest: p.onAddInterest,
    onRemoveInterest: p.onRemoveInterest,
    describeMove,
  });
  const liveOn = live.applies;

  // "Reshuffles ~2 of your top 5": how many of the top five positions an answer would change, averaged over its options. Kept per state.
  const impactCache = useRef<{ sig: string; map: Map<string, string> }>({ sig: '', map: new Map() });
  function impactText(item: LiveItem): string {
    const sig = JSON.stringify([p.qa, p.subs, interestKeys, Object.keys(fits), p.month, p.bands, p.home, p.maxHours, p.levels]);
    if (impactCache.current.sig !== sig) impactCache.current = { sig, map: new Map() };
    const id = `${item.interest}.${item.q.key}`;
    const hit = impactCache.current.map.get(id);
    if (hit) return hit;
    const base = limited.kept.slice(0, 5).map((r) => r.d.id);
    let total = 0;
    item.q.options.forEach((_, i) => {
      const top = keptWith(withAnswer(item.interest, item.q.key, [i])).slice(0, 5).map((r) => r.d.id);
      total += base.filter((x, n) => x !== top[n]).length;
    });
    const avg = total / Math.max(1, item.q.options.length);
    const text = avg >= 0.5 ? `Reshuffles ~${Math.max(1, Math.round(avg))} of your top 5` : 'Small effect on the list';
    impactCache.current.map.set(id, text);
    return text;
  }

  // Each answer's message ("Peru moved up 2") reaches the traveler as the same short note the rest of the flow uses.
  useEffect(() => { if (live.msg.text) p.toast(live.msg.text); }, [live.msg.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const [visibleCount, setVisibleCount] = useState(20);
  const shown = liveOn ? (live.listShown ? limited.kept : limited.kept.slice(0, settings.shortlistPlaces)) : limited.kept.slice(0, settings.shortlistPlaces);
  const teaserRef = useRef<HTMLDivElement>(null);

  // The unlock sequence scrolls the page: down to the new places, then to the teaser.
  useEffect(() => {
    if (live.fill !== 'hold') return;
    const t = setTimeout(() => {
      const id = shown[3]?.d.id;
      const el = id ? cardRefs.current.get(id) : null;
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(t);
  }, [live.fill]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (live.teaser !== 'on') return;
    const t = setTimeout(() => {
      const el = teaserRef.current;
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    }, 200);
    return () => clearTimeout(t);
  }, [live.teaser]);
  const question = useMemo(
    () => pickQuestion({ input, cards: data.cards, seenCardIds: p.seenCardIds, askedCardIds: [...p.sharpenCardIds, ...p.seenCardIds], destinations: data.destinations, month: p.month }),
    [input, data.cards, p.seenCardIds, p.sharpenCardIds, data.destinations, p.month],
  );
  const locked = isShortlistLocked({ answered: p.sharpenAnswered, hasQuestion: !!question, returning: p.returning });
  const dnaState = useMemo(() => dnaStateFor(input, data.dimensions), [input, data.dimensions]);
  const calibration = Math.round(computeDisplayCalibrationPercent(dnaState, data.cards));
  const openEntry = openId ? rankedAll.find((r) => r.d.id === openId) : undefined;

  /** The place that moved furthest (up is positive) if this answer were given, for the message after an answer. */
  function moverFor(card: DnaCard, type: SwipeType): { name: string; by: number } | null {
    const before = limited.kept.map((r) => r.d.id);
    const nextInput: ProfileInput = { ...input, answers: [...input.answers, { card, type } as Answer] };
    const after = applyFlightLimit(rankPlaces(data.destinations, weightsFor(nextInput), p.month, p.bands, match.factors), p.home, p.maxHours, data.coords).kept.slice(0, 10);
    let best = null as { name: string; by: number } | null;
    after.forEach((r, i) => {
      const was = before.indexOf(r.d.id);
      if (was < 0) return;
      const by = was - i;
      if (!best || Math.abs(by) > Math.abs(best.by)) best = { name: r.d.name, by };
    });
    return best;
  }

  function answer(card: DnaCard, type: SwipeType) {
    const answered = p.sharpenAnswered + 1;
    const mover = moverFor(card, type);
    p.onSharpenAnswer(card, type);
    p.toast(answerMessage({ answered, locked: isShortlistLocked({ answered, hasQuestion: true, returning: p.returning }), mover }));
  }

  function openSwipes() {
    setSwipeCount(0);
    setSwipeCard(chooseNextCard(dnaState, data.cards, data.domains));
    setSheet('swipe');
  }
  function swipe(type: SwipeType) {
    if (!swipeCard) return;
    const card = swipeCard;
    const mover = moverFor(card, type);
    p.onSwipe(card, type);
    const n = swipeCount + 1;
    setSwipeCount(n);
    if (n >= settings.shortlistPlaces) {
      setSheet(null);
      setSwipeCard(null);
      p.toast(mover && mover.by !== 0 && !locked ? `${mover.name} moved ${mover.by > 0 ? 'up' : 'down'} ${Math.abs(mover.by)}` : 'Your taste is in');
    } else {
      const next = { ...dnaState, answeredCardIds: [...dnaState.answeredCardIds, card.id], swipeCount: dnaState.swipeCount + 1 };
      setSwipeCard(chooseNextCard(next, data.cards, data.domains));
    }
  }

  const whenLabel = p.month == null ? 'Any month' : MONTHS[p.month] + (p.week ? ` · week ${p.week}` : '');
  const whoLabel = p.who.length ? p.who.map((k) => COMPANIONS.find((c) => c.key === k)?.label ?? k).join(' + ') : 'Who?';
  const bandLabel = (dim: string, any: string) => (isNarrowed(p.bands, dim) ? p.bands[dim].map((b) => BAND_DIMENSIONS.find((d) => d.key === dim)!.bands.find((x) => x.key === b)!.label).join(' / ') : any);
  const home = airportByCode(p.home);
  const nCare = careCount(p.careProps.care, p.bands);

  const lockedNow = liveOn ? !live.unlocked : locked;
  const barChips = (
    <div className="ob2-bar">
      <button type="button" className="ob2-chip" onClick={() => setSheet('when')}>{whenLabel}</button>
      <button type="button" className="ob2-chip" onClick={() => setSheet('who')}>{whoLabel}</button>
      <button type="button" className="ob2-chip" onClick={() => setSheet('bands')}>{bandLabel('budget', 'Any budget')}</button>
      <button type="button" className="ob2-chip" onClick={() => setSheet('bands')}>{bandLabel('weather', 'Any weather')}</button>
      {home ? (
        <button type="button" className="ob2-chip firm" onClick={() => setSheet('limits')}>
          From {home.code}
          {p.maxHours ? ` · under ${p.maxHours}h` : ''}
        </button>
      ) : (
        <button type="button" className="ob2-chip" onClick={() => setSheet('limits')}>+ Flying from…</button>
      )}
      <button type="button" className="ob2-chip" onClick={() => setSheet('care')}>{nCare ? `What matters · ${nCare}` : '+ What matters'}</button>
    </div>
  );
  const boxCtx = { flow: live, setups: data.setups, levels: p.levels, subs: p.subs, qa: p.qa, chips: data.chips, nameOf, impactText, onTick: p.onTick };

  return (
    <div className={liveOn ? 'lq' : undefined}>
      {liveOn ? (
        <div className="ob2-top shortlist lq-sticky">
          <div className="ob2-brand">Your shortlist</div>
          <button type="button" className={`lq-prof${live.open ? ' open' : ''}${live.pulse ? ' pulse' : ''}${live.moreToDo ? ' ask' : ''}`} onClick={live.toggleBox} aria-expanded={live.open} aria-label={`${live.open ? 'Collapse' : 'Open'} your Travel DNA questions`}>
            <span aria-hidden="true">🧬</span>
            <span>{live.percent}%</span>
            <i className="dot" />
          </button>
        </div>
      ) : (
        <div className="ob2-top shortlist">
          <div className="ob2-brand">Your shortlist</div>
          <button type="button" className="ob2-prof" onClick={p.onDna} aria-label="Your Travel DNA">
            <span aria-hidden="true">🧬</span>
            <small>{calibration}%</small>
          </button>
        </div>
      )}
      <div className="ob2-scr">
        {liveOn ? (
          <>
            <QuestionBox ctx={boxCtx} />
            {barChips}
            <div className="lq-lh">
              <b>{live.listShown ? 'Your places' : 'Your top 5'}</b>
              <span>{live.listShown ? `ranked for you · ${limited.kept.length} places` : 'ranked for you'}</span>
            </div>
          </>
        ) : (
          <>
            {barChips}
            <div className="ob2-sharp">
              <span>{calibration < 35 ? 'First pass' : 'Sharpness'}</span>
              <div className="m"><i style={{ width: `${calibration}%` }} /></div>
              <b>{calibration}%</b>
            </div>
            {locked && (
              <div className="ob2-unl">
                <span aria-hidden="true">🔒</span>
                <div className="ut">
                  <b>Answer {settings.unlockQuestions} quick questions to unlock your full list</b>
                  <div className="m"><i style={{ width: `${(p.sharpenAnswered / settings.unlockQuestions) * 100}%` }} /></div>
                </div>
                <strong>{p.sharpenAnswered}/{settings.unlockQuestions}</strong>
              </div>
            )}
            <SharpenCard question={question} onAnswer={(t) => question && answer(question.card, t)} onSkip={() => question && p.onSharpenSkip(question.card)} />
          </>
        )}
        <div className={`ob2-tz ${!liveOn && locked ? 'lock' : ''}${liveOn && live.fill === 'hold' ? ' lq-hold-new' : ''}`}>
          <ResultsList
            ranked={shown}
            visibleCount={liveOn && live.listShown ? visibleCount : shown.length}
            onShowMore={() => setVisibleCount((v) => v + 20)}
            highlightedId={null}
            cardRefs={cardRefs}
            visited={visited}
            favorited={favorited}
            onOpenDetail={setOpenId}
            onToggleFavorited={(id) => { setFavorited((f) => ({ ...f, [id]: !f[id] })); live.markedPlace(); }}
            onToggleVisited={(id) => { setVisited((v) => ({ ...v, [id]: !v[id] })); live.markedPlace(); }}
            filterKey=""
            cardsRevealed
            inserted={liveOn && live.teaser === 'on' && shown.length >= 3 ? { after: 3, node: <div ref={teaserRef}><Teaser dest={shown[0].d} score={shown[0].s} onGotIt={live.closeTeaser} /></div> } : undefined}
          />
        </div>
        {liveOn && !live.unlocked && (
          <div className="lq-lockrow">
            {OPEN_LOCK}
            <span>The rest of your {limited.kept.length} places unlock after {live.remaining} more question{live.remaining === 1 ? '' : 's'}</span>
          </div>
        )}
        {lockedNow ? (
          liveOn ? null : <button type="button" className="ob2-seeall off" disabled>
            <span className="tx">
              <b>🔒 See {limited.kept.length} places that fit your criteria</b>
              <span>Answer {liveOn ? live.remaining : questionsToUnlock(p.sharpenAnswered)} more question{(liveOn ? live.remaining : questionsToUnlock(p.sharpenAnswered)) === 1 ? '' : 's'} to unlock</span>
            </span>
          </button>
        ) : (
          <button type="button" className="ob2-seeall" onClick={() => p.onSeeAll(weights)}>
            <span className="tx">
              <b>See {limited.kept.length} places that fit your criteria</b>
              <span>
                {limited.aside.length ? `${limited.aside.length} set aside by your limits · ` : ''}the full results page
              </span>
            </span>
            <i aria-hidden="true">›</i>
          </button>
        )}
        {limited.aside.length > 0 && (
          <div className="ob2-hid">
            <button type="button" className="ob2-link plain" onClick={() => setShowAside((s) => !s)}>
              {showAside ? '▾' : '▸'} {limited.aside.length} place{limited.aside.length > 1 ? 's' : ''} set aside by your limits
            </button>
            {showAside && (
              <ul>
                {limited.aside.map((a) => (
                  <li key={a.d.id}>
                    <b>{a.d.name}</b>: {a.why}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn ghost" onClick={openSwipes}>
          Teach us your taste ({settings.shortlistPlaces} swipes)
        </button>
        <button type="button" className="ob2-btn" onClick={p.onSave}>
          Save to my Travel DNA
        </button>
      </div>

      {sheet === 'who' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3>Who is going?</h3>
          <div className="ob2-otp">
            {COMPANIONS.map((c) => (
              <button key={c.key} type="button" className={`ob2-opill ${p.who.includes(c.key) ? 'on' : ''}`} aria-pressed={p.who.includes(c.key)} onClick={() => p.onWho(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === 'when' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3>When?</h3>
          <div className="ob2-chips">
            {MONTHS.map((m, j) => (
              <button key={m} type="button" className={`ob2-chip ${p.month === j ? 'on' : ''}`} aria-pressed={p.month === j} onClick={() => p.onMonth(j)}>
                {m}
              </button>
            ))}
          </div>
          {p.month != null && (
            <div className="ob2-chips">
              {WEEKS.map((w, j) => (
                <button key={w} type="button" className={`ob2-chip ${p.week === j ? 'on' : ''}`} aria-pressed={p.week === j} onClick={() => p.onWeek(j)}>
                  {w}
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
      {sheet === 'bands' && (
        <Sheet onClose={() => setSheet(null)}>
          <OpenToCard dims={['budget', 'weather', 'vibe', 'physical']} bands={p.bands} onToggle={p.onBandPill} />
        </Sheet>
      )}
      {sheet === 'care' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3>What matters when you choose?</h3>
          <CareAccordion {...p.careProps} bare open />
        </Sheet>
      )}
      {sheet === 'limits' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3>Your limits</h3>
          <div className="ob2-lbl">Flying from</div>
          <HomePicker home={p.home} onPick={p.onPickHome} onClear={p.onClearHome} />
          <div className="ob2-lbl">Longest flight</div>
          <div className="ob2-chips">
            {settings.flightHourLimits.map((h) => (
              <button key={h} type="button" className={`ob2-chip ${p.maxHours === h ? 'on' : ''}`} aria-pressed={p.maxHours === h} onClick={() => (p.home ? p.onMaxHours(h) : p.onNeedHome())}>
                {h === 0 ? 'No limit' : `${h} hours`}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === 'swipe' && swipeCard && (
        <Sheet onClose={() => setSheet(null)} done={false}>
          <div className="ob2-sg">Card {swipeCount + 1} of {settings.shortlistPlaces}</div>
          <TasteCard card={swipeCard} onAnswer={swipe} />
          <button type="button" className="ob2-link" onClick={() => setSheet(null)}>
            Stop here
          </button>
        </Sheet>
      )}
      {openEntry && (
        <DestinationDetailSheet
          key={openEntry.d.id}
          dest={openEntry.d}
          weights={weights}
          emojiOverrides={data.emojiOverrides}
          shortNames={data.shortNames}
          bands={p.bands}
          selectedStyles={{}}
          factors={match.factors}
          notes={match.notes[openEntry.d.id]}
          month={p.month == null ? new Date().getMonth() + 1 : p.month + 1}
          visited={!!visited[openEntry.d.id]}
          onToggleVisited={() => setVisited((v) => ({ ...v, [openEntry.d.id]: !v[openEntry.d.id] }))}
          favorited={!!favorited[openEntry.d.id]}
          onToggleFavorited={() => setFavorited((f) => ({ ...f, [openEntry.d.id]: !f[openEntry.d.id] }))}
          onClose={() => setOpenId(null)}
        />
      )}
      {liveOn && (
        <div className={`lq-pop${live.pop.on ? ' show' : ''}`} role="status" aria-live="polite">
          {OPEN_LOCK}
          <span>{live.pop.text}</span>
        </div>
      )}
    </div>
  );
}
