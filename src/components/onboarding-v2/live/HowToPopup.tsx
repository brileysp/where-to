'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InterestChip } from '@/components/results/InterestChip';
import { ResultsList } from '@/components/results/ResultsList';
import { prefersReducedMotion } from '@/components/results/useResortDemo';
import { rankingMonth } from '@/lib/onboarding/shortlist';
import type { RankedDestination } from '@/lib/scoring/rank';

export interface HowToChip {
  key: string;
  emoji: string;
  label: string;
  fullLabel: string;
}

/** How long the window stays after the second lesson has finished, unless the traveler closes it first. */
const STAY_MS = 3000;
const SHOW = 4;

/**
 * The two lessons for the full list in a small window over it, so nothing on the page itself moves: first how the interest chips re-sort the
 * list, then how to mark a place as visited. Both play on the traveler's own top places (nothing is saved). The X closes it at any point, the
 * circular arrow plays both again, and it goes away on its own three seconds after the second lesson ends.
 */
export function HowToPopup({ pool: poolIn, chips: chipsIn, month, factors: factorsIn, onClose }: { pool: RankedDestination[]; chips: HowToChip[]; month: number | null; factors: Record<string, Record<string, number>>; onClose: () => void }) {
  // What the lesson shows is fixed when it opens, so the page behind it changing never restarts it.
  const [snap] = useState(() => ({ pool: poolIn, chips: chipsIn, factors: factorsIn }));
  const { pool, chips, factors } = snap;
  const [run, setRun] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [pinned, setPinned] = useState<string | null>(null);
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const finger = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const manual = useRef(false);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // The list as the chips would sort it, the way the full list does it, so the lesson shows what really happens.
  const list = useMemo(() => {
    if (!pinned) return pool;
    const m = rankingMonth(month) - 1;
    return pool
      .map((r) => ({ d: r.d, s: (r.d.monthly[pinned]?.[m] ?? 0) * (factors[r.d.id]?.[pinned] ?? 1), overall: r.s }))
      .sort((a, b) => b.s - a.s || b.overall - a.overall)
      .map(({ d, s }) => ({ d, s }));
  }, [pool, pinned, month, factors]);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (finger.current) finger.current.hidden = true;
  }, []);

  const fingerTo = useCallback((el: Element | null | undefined, tap: boolean) => {
    const box = stage.current, f = finger.current;
    if (!box || !f || !el) return;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    f.hidden = false;
    f.style.left = `${r.left - b.left + r.width / 2 - 11}px`;
    f.style.top = `${r.top - b.top + r.height / 2 - 11}px`;
    if (tap) { f.classList.remove('tap'); void f.offsetWidth; f.classList.add('tap'); }
  }, []);

  useEffect(() => {
    manual.current = false;
    stop();
    if (prefersReducedMotion() || chips.length === 0 || pool.length === 0) return stop;
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(() => { if (!manual.current) fn(); }, ms)); };
    const card = (sel: string) => {
      const el = [...cardRefs.current.values()].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      return el?.querySelector<HTMLElement>(sel) ?? null;
    };
    const chipAt = (i: number) => stage.current?.querySelectorAll<HTMLElement>('.ichip')[i];
    const c1 = chips[0], c2 = chips[1];
    // Lesson 1: tap an interest, then another, then back to "My Interests".
    at(700, () => fingerTo(chipAt(1), false));
    at(1300, () => fingerTo(chipAt(1), true));
    at(1500, () => setPinned(c1.key));
    if (c2) {
      at(3200, () => fingerTo(chipAt(2), false));
      at(3800, () => fingerTo(chipAt(2), true));
      at(4000, () => setPinned(c2.key));
    }
    const back = c2 ? 5800 : 3400;
    at(back, () => fingerTo(chipAt(0), false));
    at(back + 600, () => fingerTo(chipAt(0), true));
    at(back + 800, () => setPinned(null));
    at(back + 1700, () => { if (finger.current) finger.current.hidden = true; });
    // Lesson 2: the flag on the top place, then the Visited chip it opens.
    const s2 = back + 2300;
    at(s2, () => setStep(2));
    at(s2 + 700, () => fingerTo(card('.card-bookmark-btn'), false));
    at(s2 + 1400, () => fingerTo(card('.card-bookmark-btn'), true));
    at(s2 + 1650, () => card('.card-bookmark-btn')?.click());
    at(s2 + 2500, () => fingerTo(card('.card-chip-visited'), false));
    at(s2 + 3200, () => fingerTo(card('.card-chip-visited'), true));
    at(s2 + 3350, () => card('.card-chip-visited')?.click());
    at(s2 + 4200, () => { if (finger.current) finger.current.hidden = true; });
    at(s2 + 4400, () => setFinished(true));
    return stop;
  }, [run, chips, pool, stop, fingerTo]);

  // Five seconds after the second lesson ends the window leaves by itself. A tap on the demo by the traveler cancels that.
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => { if (!manual.current) closeRef.current(); }, STAY_MS);
    return () => clearTimeout(t);
  }, [finished]);

  function takeOver() {
    if (manual.current) return;
    manual.current = true;
    stop();
  }
  const toggle = (set: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, id: string) => set((m) => ({ ...m, [id]: !m[id] }));
  function replay() {
    setStep(1);
    setFinished(false);
    setPinned(null);
    setVisited({});
    setSaved({});
    setRun((n) => n + 1);
  }

  return (
    <div className="lq-howbg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lq-how res-scope" role="dialog" aria-modal="true" aria-label="How to use your list">
        <div className="lq-how-top">
          <span className="lq-how-badge"><span aria-hidden="true">💡</span> Quick tips</span>
          <span className="lq-how-count">Tip {step} of 2</span>
        </div>
        <div className="lq-how-head">
          <div className="lq-how-steps" aria-live="polite">
            <span className={step === 1 ? 'on' : ''}><i>1</i> Re-sort by an interest</span>
            <span className={step === 2 ? 'on' : ''}><i>2</i> Mark where you’ve been</span>
          </div>
          <button type="button" className="lq-how-btn" onClick={replay} aria-label="Play again">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
          </button>
          <button type="button" className="lq-how-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <p className="lq-how-cap">{step === 1 ? 'Tap an interest to re-sort your places by it.' : 'Tap the flag on a place to mark it Visited.'}</p>
        <div className="lq-how-stage" ref={stage} onPointerDownCapture={takeOver}>
          <div className="quick-chip-row-wrap">
            <div className="quick-chip-row">
              <InterestChip emoji="🧬" label="My Interests" active={pinned === null} onClick={() => setPinned(null)} />
              {chips.map((c) => (
                <InterestChip key={c.key} emoji={c.emoji} label={c.label} fullLabel={c.fullLabel} active={pinned === c.key} onClick={() => setPinned(c.key)} />
              ))}
            </div>
            <div className="quick-chip-row-fade" aria-hidden />
          </div>
          <ResultsList
            ranked={list}
            visibleCount={SHOW}
            onShowMore={() => {}}
            highlightedId={null}
            cardRefs={cardRefs}
            visited={visited}
            favorited={saved}
            onOpenDetail={() => {}}
            onToggleFavorited={(id) => toggle(setSaved, id)}
            onToggleVisited={(id) => toggle(setVisited, id)}
            filterKey="how"
            cardsRevealed
          />
          <div className="lq-finger" ref={finger} hidden />
        </div>
        <p className="lq-how-demo">A demo with your own top places. Nothing here is saved.</p>
      </div>
    </div>
  );
}
