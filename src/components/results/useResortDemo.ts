'use client';

import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'whereto:resort-demo-seen';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Storage blocked (private mode) — the demo may replay next visit, which beats throwing.
  }
}

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

interface Args {
  /** Results are on screen and settled (month chosen, not mid-"fetching"). */
  ready: boolean;
  /** Keys of the interest chips, in row order, excluding "My Interests". */
  chipKeys: string[];
  pinChip: (key: string | null) => void;
  /** Positioned ancestor the cursor is drawn inside. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** The chip row — the demo waits until it's actually on screen. */
  chipRowRef: React.RefObject<HTMLElement | null>;
  chipEls: React.RefObject<Map<string, HTMLElement>>;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
  /** Result ids in the order they are currently displayed. */
  rowIds: () => string[];
}

export interface DemoCursor {
  visible: boolean;
  pressed: boolean;
  left: number;
  top: number;
}

const HIDDEN_CURSOR: DemoCursor = { visible: false, pressed: false, left: 0, top: 0 };
const REVEAL_ROWS = 8;

/**
 * First-visit walkthrough (design "2b"): results drop into ranked order, a
 * banner explains the chips, then a demo cursor taps two interests so the
 * re-sort animation plays for real, and finally the list returns to the
 * user's own ranking. Plays once per browser; any tap ends it early.
 */
export function useResortDemo({ ready, chipKeys, pinChip, containerRef, chipRowRef, chipEls, cardRefs, rowIds }: Args) {
  const [calloutVisible, setCalloutVisible] = useState(false);
  const [cursor, setCursor] = useState<DemoCursor>(HIDDEN_CURSOR);
  const [chipRowInView, setChipRowInView] = useState(false);

  // The effect below must not restart when these change identity mid-demo.
  const latest = useRef({ chipKeys, pinChip, rowIds });
  useEffect(() => {
    latest.current = { chipKeys, pinChip, rowIds };
  });
  const finished = useRef(false);

  // On a phone the results sit below the sidebar — running the demo while
  // the chips are off screen would burn the one-time showing unseen.
  useEffect(() => {
    const el = chipRowRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setChipRowInView(entry.isIntersecting), { threshold: 0.9 });
    io.observe(el);
    return () => io.disconnect();
  }, [chipRowRef, ready]);

  useEffect(() => {
    if (!ready || !chipRowInView || finished.current) return;
    if (alreadySeen() || prefersReducedMotion() || latest.current.chipKeys.length === 0) return;

    const keys = latest.current.chipKeys.slice(0, 2);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const push = (fn: () => void, delay: number) => timers.push(setTimeout(fn, delay));
    let pinnedByDemo = false;

    const cursorTo = (key: string) => {
      const chip = chipEls.current.get(key);
      const box = containerRef.current;
      if (!chip || !box) return;
      const r = chip.getBoundingClientRect();
      const c = box.getBoundingClientRect();
      setCursor({ visible: true, pressed: false, left: r.left - c.left + r.width / 2, top: r.top - c.top + r.height / 2 });
    };
    const press = () => {
      setCursor((cur) => ({ ...cur, pressed: true }));
      push(() => setCursor((cur) => ({ ...cur, pressed: false })), 220);
    };
    const tap = (key: string) => {
      pinnedByDemo = true;
      latest.current.pinChip(key);
    };

    // Rows drop in from above, top row first.
    const ids = latest.current.rowIds().slice(0, REVEAL_ROWS);
    const cards = ids.map((id) => cardRefs.current.get(id));
    cards.forEach((el) => {
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-26px)';
    });
    requestAnimationFrame(() => {
      cards.forEach((el, i) => {
        if (!el) return;
        el.style.transition = `transform 480ms cubic-bezier(0.34,1.56,0.64,1) ${i * 70}ms, opacity 320ms ease ${i * 70}ms`;
        el.style.transform = '';
        el.style.opacity = '1';
      });
    });
    push(() => {
      cards.forEach((el) => {
        if (el) {
          el.style.transition = '';
          el.style.opacity = '';
        }
      });
    }, 480 + REVEAL_ROWS * 70 + 50);

    // The banner collapses before the cursor moves: it sits above the chips,
    // so collapsing after aiming would leave the cursor pointing at empty
    // space where the chip used to be.
    push(() => setCalloutVisible(true), 400);
    push(() => setCalloutVisible(false), 2200);
    push(() => cursorTo(keys[0]), 2650);
    push(press, 3150);
    push(() => tap(keys[0]), 3410);
    if (keys[1]) {
      push(() => cursorTo(keys[1]), 4550);
      push(press, 5050);
      push(() => tap(keys[1]), 5310);
    }
    const endAt = keys[1] ? 6250 : 4700;
    push(() => setCursor(HIDDEN_CURSOR), endAt);
    // Back to the user's own ranking — leaving a chip pinned that they
    // never chose would misstate what the list is sorted by.
    push(() => {
      latest.current.pinChip(null);
      pinnedByDemo = false;
      finished.current = true;
      markSeen();
      document.removeEventListener('pointerdown', onPointerDown, true);
    }, endAt + 450);

    const stop = (restore: boolean) => {
      timers.forEach(clearTimeout);
      setCalloutVisible(false);
      setCursor(HIDDEN_CURSOR);
      cards.forEach((el) => {
        if (el) {
          el.style.transition = '';
          el.style.transform = '';
          el.style.opacity = '';
        }
      });
      if (restore && pinnedByDemo) latest.current.pinChip(null);
      pinnedByDemo = false;
    };

    // Any real tap ends the demo. Tapping a chip is the user taking over,
    // so their pick stays; tapping anything else puts the list back.
    const onPointerDown = (e: PointerEvent) => {
      const onChip = e.target instanceof Element && e.target.closest('.quick-chip');
      stop(!onChip);
      finished.current = true;
      markSeen();
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      stop(true);
    };
  }, [ready, chipRowInView, chipEls, cardRefs, containerRef]);

  return { calloutVisible, cursor };
}
