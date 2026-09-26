'use client';

import { useEffect, useRef, useState } from 'react';
import { barColor } from '@/lib/scoring/rank';

/** Long interest names read badly inside a pill: "Cycling - Road & Gravel Biking" becomes "Cycling - Road". */
export function shortInterestLabel(label: string): string {
  return label.split(' & ')[0];
}

/**
 * An interest chip: a round emoji button that opens into a labelled pill when it is the selected
 * one. Used by the results header (no scores) and by a destination's For You tab (a score bubble
 * on the corner, open or closed).
 *
 * The chip keeps its DOM node across selection changes (callers key it by interest), so the
 * open/close motion is plain CSS transitions on `.active` — see `.ichip` in results.css.
 *
 * `score` decides whether there is a bubble at all: leave it undefined for none, pass a number
 * for the score, or null for "not available here".
 */
export function InterestChip({
  emoji,
  label,
  fullLabel,
  active,
  onClick,
  score,
  chipRef,
}: {
  emoji: string;
  label: string;
  /** The complete name, for screen readers, when `label` is shortened. */
  fullLabel?: string;
  active: boolean;
  onClick: () => void;
  score?: number | null;
  chipRef?: (el: HTMLButtonElement | null) => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const wasActive = useRef(active);
  const [pulse, setPulse] = useState(false);

  // A chip that becomes selected pulses once, and the row scrolls if needed so the opening chip
  // (and its bubble) is never partly off the edge. Chips before it are pushed off the other side.
  useEffect(() => {
    if (active && !wasActive.current) {
      setPulse(true);
      const stop = setTimeout(() => setPulse(false), 450);
      const cancel = keepChipInView(ref.current);
      wasActive.current = active;
      return () => {
        clearTimeout(stop);
        cancel();
      };
    }
    wasActive.current = active;
  }, [active]);

  const hasBubble = score !== undefined;
  const bubbleText = score == null ? '–' : score.toFixed(1);
  const bubbleColor = score == null ? 'var(--text-faint)' : barColor(score);
  // The "okay" yellow is too light for white text.
  const bubbleInk = score != null && score >= 5 && score < 6.5 ? '#3b2d05' : '#fff';

  return (
    <button
      type="button"
      ref={(el) => {
        ref.current = el;
        chipRef?.(el);
      }}
      className={`ichip${active ? ' active' : ''}${pulse ? ' just' : ''}`}
      aria-pressed={active}
      aria-label={hasBubble ? `${fullLabel ?? label}, ${score == null ? 'not available' : score.toFixed(1)}` : (fullLabel ?? label)}
      onClick={onClick}
    >
      <span className="ichip-emoji">{emoji}</span>
      <span className="ichip-reveal">
        <span className="ichip-inner">
          <span className="ichip-label">{label}</span>
        </span>
      </span>
      {hasBubble && (
        <span className="ichip-bubble" style={{ background: bubbleColor, color: bubbleInk }}>
          {bubbleText}
        </span>
      )}
    </button>
  );
}

const KEEP_IN_VIEW_MS = 420;
const EDGE_PAD = 14;
// Space the score bubble hangs past the chip's right edge.
const BUBBLE_OVERHANG = 8;

/** While a chip grows, nudge its scrolling row each frame so it stays fully inside the row's visible box. */
function keepChipInView(chip: HTMLElement | null): () => void {
  const row = chip?.parentElement;
  if (!chip || !row) return () => {};
  let raf = 0;
  const start = performance.now();
  const step = (now: number) => {
    const rr = row.getBoundingClientRect();
    const cr = chip.getBoundingClientRect();
    const over = cr.right + BUBBLE_OVERHANG - (rr.right - EDGE_PAD);
    if (over > 0) row.scrollLeft += over;
    const under = rr.left + EDGE_PAD - cr.left;
    if (under > 0) row.scrollLeft -= under;
    if (now - start < KEEP_IN_VIEW_MS) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
