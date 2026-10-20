import { useMemo, useRef, useState } from 'react';
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
  const rankedAll = useMemo(() => rankPlaces(data.destinations, weights, p.month, p.bands), [data.destinations, weights, p.month, p.bands]);
  const limited = useMemo(() => applyFlightLimit(rankedAll, p.home, p.maxHours, data.coords), [rankedAll, p.home, p.maxHours, data.coords]);
  const shown = limited.kept.slice(0, settings.shortlistPlaces);
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
    const after = applyFlightLimit(rankPlaces(data.destinations, weightsFor(nextInput), p.month, p.bands), p.home, p.maxHours, data.coords).kept.slice(0, 10);
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

  return (
    <>
      <div className="ob2-top shortlist">
        <div className="ob2-brand">Your shortlist</div>
        <button type="button" className="ob2-prof" onClick={p.onDna} aria-label="Your Travel DNA">
          <span aria-hidden="true">🧬</span>
          <small>{calibration}%</small>
        </button>
      </div>
      <div className="ob2-scr">
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
        <div className={`ob2-tz ${locked ? 'lock' : ''}`}>
          <ResultsList
            ranked={shown}
            visibleCount={shown.length}
            onShowMore={() => {}}
            highlightedId={null}
            cardRefs={cardRefs}
            visited={visited}
            favorited={favorited}
            onOpenDetail={setOpenId}
            onToggleFavorited={(id) => setFavorited((f) => ({ ...f, [id]: !f[id] }))}
            onToggleVisited={(id) => setVisited((v) => ({ ...v, [id]: !v[id] }))}
            filterKey=""
            cardsRevealed
          />
        </div>
        {locked ? (
          <button type="button" className="ob2-seeall off" disabled>
            <span className="tx">
              <b>🔒 See {limited.kept.length} places that fit your criteria</b>
              <span>Answer {questionsToUnlock(p.sharpenAnswered)} more question{questionsToUnlock(p.sharpenAnswered) === 1 ? '' : 's'} to unlock</span>
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
          month={p.month == null ? new Date().getMonth() + 1 : p.month + 1}
          visited={!!visited[openEntry.d.id]}
          onToggleVisited={() => setVisited((v) => ({ ...v, [openEntry.d.id]: !v[openEntry.d.id] }))}
          favorited={!!favorited[openEntry.d.id]}
          onToggleFavorited={() => setFavorited((f) => ({ ...f, [openEntry.d.id]: !f[openEntry.d.id] }))}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
