import { useEffect, useState } from 'react';

// How long a rating/feedback click stays "pending" before its calibration
// effect actually applies — matches the previous full-screen overlay's
// timing exactly, since this is a relocation of that animation, not a
// pacing change.
export const RECALIBRATION_DURATION_MS = 1300;

const SUBTEXT_INTERVAL_MS = 350;

export const RECALIBRATION_SUBTEXTS = [
  'Updating signals…',
  'Re-testing assumptions…',
  'Adjusting confidence…',
  'Looking for stronger patterns…',
  'Refining your Travel DNA…',
];

/** Cycles through RECALIBRATION_SUBTEXTS while `active`; resets to the first phrase each time it turns on. */
export function useRecalibrationCopy(active: boolean): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % RECALIBRATION_SUBTEXTS.length);
    }, SUBTEXT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  return RECALIBRATION_SUBTEXTS[index];
}
