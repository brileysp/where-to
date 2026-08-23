'use client';

import { useState } from 'react';
import type { Feedback } from '@/lib/dna/summary';
import type { LearningCheck } from '@/lib/dna/types';
import { CalibrationMeter } from '../CalibrationMeter';
import { useRecalibrationCopy } from '../recalibration';

export function LearningCheckScreen({
  learningCheck,
  calibrationPercent,
  onFeedback,
}: {
  learningCheck: LearningCheck;
  calibrationPercent: number;
  onFeedback: (feedback: Feedback) => void;
}) {
  // This screen unmounts once the recalibration resolves (proceedAfterSwipe
  // moves the flow on), so there's no "reset" case to handle — picked just
  // needs to hold for the ~1.3s wait.
  const [picked, setPicked] = useState<Feedback | null>(null);
  const subtext = useRecalibrationCopy(picked !== null);

  function choose(feedback: Feedback) {
    setPicked(feedback);
    onFeedback(feedback);
  }

  return (
    <div className="dna-screen dna-insight">
      <CalibrationMeter percent={calibrationPercent} recalibrating={picked !== null} />
      <div className="dna-insight-card">
        <div className="dna-insight-kicker">Quick check before we hardwire this:</div>
        <div className="dna-insight-question">{learningCheck.title}</div>
        <p className="dna-insight-text">{learningCheck.insightText} Does that feel right?</p>
        {learningCheck.evidenceLine && (
          <p className="dna-insight-why">
            <strong>Why we&apos;re asking:</strong>{' '}
            <span dangerouslySetInnerHTML={{ __html: learningCheck.evidenceLine }} />
          </p>
        )}
        <div className="dna-insight-buttons">
          <button
            className={`dna-insight-btn dna-insight-yes${picked === 'confirmed' ? ' chosen' : ''}${picked && picked !== 'confirmed' ? ' dimmed' : ''}`}
            disabled={picked !== null}
            onClick={() => choose('confirmed')}
          >
            👍 Yes, that&apos;s right
          </button>
          <button
            className={`dna-insight-btn dna-insight-no${picked === 'rejected' ? ' chosen' : ''}${picked && picked !== 'rejected' ? ' dimmed' : ''}`}
            disabled={picked !== null}
            onClick={() => choose('rejected')}
          >
            👎 Not really
          </button>
          <button
            className={`dna-insight-btn dna-insight-unsure${picked === 'unsure' ? ' chosen' : ''}${picked && picked !== 'unsure' ? ' dimmed' : ''}`}
            disabled={picked !== null}
            onClick={() => choose('unsure')}
          >
            🤷 Not sure
          </button>
        </div>
        {picked !== null && <p className="dna-rating-thinking">{subtext}</p>}
      </div>
    </div>
  );
}
