'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DestinationCard } from '@/components/results/DestinationCard';
import type { ScoredDestination } from '@/lib/scoring/types';

/**
 * "Mark where you've been": plays the real card's flag, the Visited chip and the stamp on a practice card (nothing is saved, no passport is
 * stamped), with a finger that shows where to tap. The first tap by the traveler stops the show and hands over control.
 */
export function Teaser({ dest, score, onGotIt }: { dest: ScoredDestination; score: number; onGotIt: () => void }) {
  const [visited, setVisited] = useState(false);
  const [saved, setSaved] = useState(false);
  const [run, setRun] = useState(0);
  const [gone, setGone] = useState(false);
  const demo = useRef<HTMLDivElement>(null);
  const finger = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const manual = useRef(false);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (finger.current) finger.current.hidden = true;
  }, []);
  const at = useCallback((ms: number, fn: () => void) => { timers.current.push(setTimeout(() => { if (!manual.current) fn(); }, ms)); }, []);
  const fingerTo = useCallback((sel: string, tap: boolean) => {
    const d = demo.current, f = finger.current;
    const tg = d?.querySelector<HTMLElement>(sel);
    if (!d || !f || !tg) return;
    const r = tg.getBoundingClientRect(), b = d.getBoundingClientRect();
    f.hidden = false;
    f.style.left = `${r.left - b.left + r.width / 2 - 10}px`;
    f.style.top = `${r.top - b.top + r.height / 2 - 10}px`;
    if (tap) { f.classList.remove('tap'); void f.offsetWidth; f.classList.add('tap'); }
  }, []);
  const click = useCallback((sel: string) => { demo.current?.querySelector<HTMLElement>(sel)?.click(); }, []);

  useEffect(() => {
    manual.current = false;
    stop();
    at(700, () => fingerTo('.card-bookmark-btn', false));
    at(1500, () => fingerTo('.card-bookmark-btn', true));
    at(1750, () => click('.card-bookmark-btn'));
    at(2500, () => fingerTo('.card-chip-visited', false));
    at(3200, () => fingerTo('.card-chip-visited', true));
    at(3350, () => click('.card-chip-visited'));
    at(3700, () => { if (finger.current) finger.current.hidden = true; });
    return stop;
  }, [run, at, click, fingerTo, stop]);

  function takeOver() {
    if (manual.current) return;
    manual.current = true;
    stop();
  }
  function replay() {
    setVisited(false);
    setSaved(false);
    setRun((n) => n + 1);
  }

  return (
    <div className={`lq-teaser${gone ? ' gone' : ''}`}>
      <div className="tt">
        <b>Mark where you’ve been</b>
        <span>Tap the flag on any place to mark it Visited.</span>
      </div>
      <div className="lq-demo" ref={demo} onPointerDownCapture={takeOver}>
        <DestinationCard
          key={run}
          dest={dest}
          rank={1}
          score={score}
          highlighted={false}
          visited={visited}
          favorited={saved}
          onOpenDetail={() => {}}
          onToggleFavorited={() => setSaved((s) => !s)}
          onToggleVisited={() => setVisited((v) => !v)}
        />
        <div className="lq-finger" ref={finger} hidden />
      </div>
      <div className="lq-tf">
        <button type="button" className="lq-link" onClick={replay}>Replay</button>
        <button type="button" className="lq-cta small" onClick={() => { setGone(true); setTimeout(onGotIt, 380); }}>Got it</button>
      </div>
    </div>
  );
}
