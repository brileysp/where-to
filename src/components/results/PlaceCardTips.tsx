'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ForYouTab } from './ForYouTab';
import { prefersReducedMotion } from './useResortDemo';
import type { InterestFactors, PlaceAdjust, SelectedBands, SelectedStyles } from '@/lib/scoring/rank';
import type { PlaceNote } from '@/lib/onboarding/live-factors';
import type { ScoredDestination } from '@/lib/scoring/types';

/** Where "the tips for the place card were shown" is remembered. */
export const PLACE_TIPS_SEEN_KEY = 'whereto:place-card-tips-seen';
const STAY_MS = 3000;
/** How long the pointer takes to glide to its target (matches .pt-finger's left/top transition in results.css). */
const FINGER_GLIDE_MS = 1200;
/** The card sits still this long before anything moves, how long each result stays up before the next thing happens, and how long the chart takes to scroll into view. */
const LEAD_MS = 3000;
const HOLD_MS = 3500;
const SCROLL_MS = 1600;

/** Scrolls a box to `top` in one slow, even move (the browser's own smooth scroll is quick and jerky for a distance this long). */
function glideScroll(box: HTMLElement, top: number, ms: number) {
  const from = box.scrollTop, t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    box.scrollTop = from + (top - from) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * The first time a place card opens, a short demo on that very place: tap an interest to see how the place does for it, tap My Interests to come
 * back, then tap months on the chart to compare them. It plays the real For You tab, driven by a pointer, in a small frosted window (nothing is
 * saved). X closes it at any point, the circular arrow plays it again, and it leaves by itself three seconds after the end.
 */
export function PlaceCardTips({
  dest,
  weights,
  emojiOverrides,
  shortNames,
  bands,
  selectedStyles,
  startMonth,
  factors,
  adjust,
  notes,
  interestKeys,
  onClose,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  emojiOverrides: Record<string, string>;
  shortNames: Record<string, string>;
  bands: SelectedBands;
  selectedStyles?: SelectedStyles;
  startMonth: number;
  factors?: InterestFactors;
  adjust?: PlaceAdjust;
  notes?: Record<string, PlaceNote>;
  interestKeys?: string[];
  onClose: () => void;
}) {
  const [run, setRun] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [sel, setSel] = useState<string | null>(null);
  const [idx, setIdx] = useState(startMonth);
  const [finished, setFinished] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const finger = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const manual = useRef(false);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

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
    f.style.left = `${r.left - b.left + r.width / 2 - 15}px`;
    f.style.top = `${r.top - b.top + r.height / 2 - 15}px`;
    if (tap) { f.classList.remove('tap'); void f.offsetWidth; f.classList.add('tap'); }
  }, []);

  useEffect(() => {
    manual.current = false;
    stop();
    clip.current?.scrollTo({ top: 0 });
    if (prefersReducedMotion()) return stop;
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(() => { if (!manual.current) fn(); }, ms)); };
    // Elements are looked up at the moment they are needed: tapping an interest swaps the chart for a new one, so one found earlier would be gone.
    const chip = (i: number) => () => stage.current?.querySelectorAll<HTMLElement>('.interest-chip-row .ichip')[i];
    const bar = (i: number) => () => stage.current?.querySelectorAll<HTMLElement>('.months-chart-bar-wrap')[i];
    const nChips = stage.current?.querySelectorAll('.interest-chip-row .ichip').length ?? 0;
    // One tap at a time: the pointer glides over, rests, presses, and the tap lands as the press ends. Returns when the tap has landed.
    const tap = (el: () => HTMLElement | undefined, move: number) => {
      at(move, () => fingerTo(el(), false));
      at(move + FINGER_GLIDE_MS + 600, () => fingerTo(el(), true));
      at(move + FINGER_GLIDE_MS + 900, () => el()?.click());
      return move + FINGER_GLIDE_MS + 900;
    };
    // Slowed right down and cut to two basic things (owner, 22 Nov 2026: it was chaotic, too fast and jumpy; nothing could be read). Each result stays
    // on screen for HOLD_MS before anything else happens. The card first sits still for LEAD_MS while its own opening animation finishes and it can be read.
    let t = LEAD_MS;
    // Tip 1: one interest.
    if (nChips > 1) t = tap(chip(1), t) + HOLD_MS;
    else t += HOLD_MS;
    at(t, () => { setStep(2); if (finger.current) finger.current.hidden = true; });
    t += 1200;
    // Tip 2: bring the month chart into view (slowly, in one move), then tap two months, one at a time.
    at(t, () => {
      const c = clip.current, bars = stage.current?.querySelector<HTMLElement>('.months-chart');
      if (!c || !bars) return;
      const top = bars.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 36;
      glideScroll(c, Math.max(0, top), SCROLL_MS);
    });
    t += SCROLL_MS + 800;
    t = tap(bar((startMonth + 3) % 12), t) + HOLD_MS;
    t = tap(bar((startMonth + 6) % 12), t) + HOLD_MS;
    at(t, () => { if (finger.current) finger.current.hidden = true; });
    at(t + 200, () => setFinished(true));
    return stop;
  }, [run, startMonth, stop, fingerTo]);

  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => { if (!manual.current) closeRef.current(); }, STAY_MS);
    return () => clearTimeout(t);
  }, [finished]);

  function replay() {
    setStep(1);
    setSel(null);
    setIdx(startMonth);
    setFinished(false);
    setRun((n) => n + 1);
  }
  function takeOver() {
    if (manual.current) return;
    manual.current = true;
    stop();
  }

  return (
    <div className="pt-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pt-card" role="dialog" aria-modal="true" aria-label="How to read a place">
        <div className="pt-top">
          <span className="pt-badge"><span aria-hidden="true">💡</span> Quick tips</span>
          <span className="pt-count">Tip {step} of 2</span>
          <button type="button" className="pt-btn" onClick={replay} aria-label="Play again">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
          </button>
          <button type="button" className="pt-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <p className="pt-cap">{step === 1 ? 'Tap an interest to see how this place does for it.' : 'Tap a month to compare months.'}</p>
        <div className="pt-stage" ref={stage} onPointerDownCapture={takeOver}>
          <div className="pt-clip" ref={clip}>
            <ForYouTab
              key={run}
              dest={dest}
              weights={weights}
              emojiOverrides={emojiOverrides}
              shortNames={shortNames}
              bands={bands}
              selectedStyles={selectedStyles}
              previewIdx={idx}
              onChangeMonth={setIdx}
              selectedCategory={sel}
              onSelectCategory={setSel}
              factors={factors}
              adjust={adjust}
              searchIdx={startMonth}
              notes={notes}
              interestKeys={interestKeys}
            />
          </div>
          <div className="pt-finger" ref={finger} hidden />
        </div>
        <p className="pt-demo">A demo on this place. Nothing here is saved.</p>
      </div>
    </div>
  );
}
