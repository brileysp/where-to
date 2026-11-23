'use client';

import { useEffect, useRef, useState } from 'react';
import { DotSphere, themePalette } from './dotSphere';

/**
 * "Mapping your Travel DNA": the dot sphere from the approved prototype (dark or light with the theme) shown for a moment between the preferences and the
 * first list. It is already `from` percent full, and the rest of the dots up to `to` percent are pulled in while the DNA meter counts up. It never ends before `ready` (the places it
 * waits on have arrived); a tap ends it early once it can.
 */
export function GlobeMoment({ from, to, label, lines, duration, ready, onDone }: { from: number; to: number; label: string; lines: [string, string]; duration: number; ready: boolean; onDone: () => void }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = reduced ? 700 : duration;
  const cv = useRef<HTMLCanvasElement>(null);
  const [pct, setPct] = useState(reduced ? to : from);
  const [elapsed, setElapsed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return;
    const sphere = new DotSphere(canvas, { spin: reduced ? 0 : 1 });
    sphere.instant(from);
    if (reduced) sphere.instant(to);
    else sphere.add(to - from, Math.max(0.4, ms / 1000 - 0.2 - 0.65 - 0.3), 0.2);
    sphere.start();
    const theme = setInterval(() => { sphere.palette = themePalette(); }, 1500);
    return () => { clearInterval(theme); sphere.stop(); };
  }, [ms, from, to, reduced]);

  useEffect(() => {
    const t = setTimeout(() => setElapsed(true), ms);
    if (reduced) return () => clearTimeout(t);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / (ms * 0.95));
      // A gentle ease-out (owner, 22 Nov 2026: the count raced at the start); a cubic ease took most of the range in the first third.
      const eased = Math.sin((k * Math.PI) / 2);
      setPct(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [ms, from, to, reduced]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => { if (elapsed && ready) finish(); });

  const secs = `${ms / 1000}s`;
  return (
    <div className="gm" role="status" aria-live="polite" onClick={() => { if (elapsed && ready) finish(); }}>
      <canvas className="gm-cv" ref={cv} aria-hidden="true" />
      <div className="gm-label">{label}</div>
      <div className="gm-status">
        <span className="gm-a" style={{ animationDuration: secs }}>{lines[0]}</span>
        <span className="gm-b" style={{ animationDuration: secs }}>{lines[1]}</span>
      </div>
      <div className="gm-meter">
        <b>DNA {pct}%</b>
        <div className="gm-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="gm-tap" style={{ opacity: elapsed && ready ? 1 : 0 }}>Tap to continue</div>
    </div>
  );
}
