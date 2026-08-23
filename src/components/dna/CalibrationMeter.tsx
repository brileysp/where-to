'use client';

import { useEffect, useRef, useState } from 'react';
import { useRecalibrationCopy } from './recalibration';

/**
 * `recalibrating` replaces the old full-screen RecalibratingOverlay: while
 * true, the "thinking" happens right here (glow + shimmer + rotating
 * microcopy) instead of blacking out the whole screen. When it flips back
 * to false with a new `percent`, the meter animates the count-up itself
 * and shows a brief delta — the segment's own `pulse` class already
 * retriggers automatically since it's recomputed fresh from `percent` on
 * every render.
 */
export function CalibrationMeter({ percent, recalibrating = false }: { percent: number; recalibrating?: boolean }) {
  const segments = 10;
  const lit = Math.round((percent / 100) * segments);
  const subtext = useRecalibrationCopy(recalibrating);

  const prevRecalibratingRef = useRef(recalibrating);
  const prevPercentRef = useRef(percent);
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    const wasRecalibrating = prevRecalibratingRef.current;
    const prevPercent = prevPercentRef.current;
    prevRecalibratingRef.current = recalibrating;
    prevPercentRef.current = percent;

    if (wasRecalibrating && !recalibrating && percent !== prevPercent) {
      setDelta(percent - prevPercent);
      const t = setTimeout(() => setDelta(null), 900);
      return () => clearTimeout(t);
    }
  }, [recalibrating, percent]);

  return (
    <div className={`dna-meter${recalibrating ? ' thinking' : ''}`}>
      <div className="dna-meter-toprow">
        <span>Travel DNA Calibration</span>
        <span className="dna-meter-percent-wrap">
          <span className="dna-meter-percent">{percent}%</span>
          <span className={`dna-meter-delta${delta !== null ? ' show' : ''}`}>
            {delta !== null ? `${delta > 0 ? '+' : ''}${delta}%` : ''}
          </span>
        </span>
      </div>
      <div className="dna-meter-track">
        {Array.from({ length: segments }).map((_, i) => {
          const isLit = i < lit;
          const isEdge = i === lit - 1;
          return <div key={i} className={`dna-meter-seg${isLit ? ' lit' : ''}${isEdge ? ' pulse' : ''}`} />;
        })}
      </div>
      {recalibrating && <div className="dna-meter-microcopy show">{subtext}</div>}
    </div>
  );
}
