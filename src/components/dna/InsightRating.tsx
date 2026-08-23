'use client';

import { useState } from 'react';
import { useRecalibrationCopy } from './recalibration';
import type { CalibrationResponse, InsightFeedback } from '@/lib/dna/types';

const STATUS_LABEL: Record<CalibrationResponse, string> = {
  spot_on: '✓ Confirmed',
  sort_of: '~ Partially understood',
  not_sure: '↺ Still being refined',
  not_really: '✕ Rejected',
};

const RESPONSES: Array<{ value: CalibrationResponse; emoji: string; label: string }> = [
  { value: 'spot_on', emoji: '✅', label: 'Spot on' },
  { value: 'sort_of', emoji: '🙂', label: 'Sort of' },
  { value: 'not_really', emoji: '❌', label: 'Not really' },
  { value: 'not_sure', emoji: '🤔', label: 'Not sure' },
];

export function InsightRating({
  feedback,
  disabled,
  onRate,
}: {
  feedback: InsightFeedback | null;
  /** True while any rating elsewhere on the page is still resolving — locks this widget out too, so a second click can't race the first. */
  disabled?: boolean;
  onRate: (response: CalibrationResponse) => void;
}) {
  // Locally tracks which button THIS widget was clicked with — independent
  // of `feedback` (which only updates once the parent's deferred
  // calibration change actually lands), so the click reads as acknowledged
  // immediately rather than doing nothing until the wait is over.
  const [picked, setPicked] = useState<CalibrationResponse | null>(null);
  const subtext = useRecalibrationCopy(picked !== null && !feedback);

  if (feedback) {
    return <div className={`dna-rating-status dna-rating-status-${feedback.response}`}>{STATUS_LABEL[feedback.response]}</div>;
  }

  return (
    <div className="dna-rating">
      <p className="dna-rating-prompt">How does this feel?</p>
      <div className="dna-rating-buttons">
        {RESPONSES.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`dna-rating-btn${picked === r.value ? ' chosen' : ''}${picked && picked !== r.value ? ' dimmed' : ''}`}
            disabled={disabled || picked !== null}
            onClick={() => {
              setPicked(r.value);
              onRate(r.value);
            }}
          >
            <span className="dna-rating-emoji">{r.emoji}</span>
            {r.label}
          </button>
        ))}
      </div>
      {picked !== null && <p className="dna-rating-thinking">{subtext}</p>}
    </div>
  );
}
