'use client';

import { useEffect, useState } from 'react';
import { CalibrationMeter } from '../CalibrationMeter';
import { DomainBadgeRow } from '../DomainBadgeRow';
import { SwipeCard } from '../SwipeCard';
import { calibrationStatusText } from '@/lib/dna/calibration';
import type { DnaCard, DnaState, DomainDef, SwipeType } from '@/lib/dna/types';

interface Props {
  dnaState: DnaState;
  currentCard: DnaCard;
  domains: DomainDef[];
  microText?: string;
  onSwipe: (type: SwipeType) => void;
  onSeeMatches: () => void;
  onBack: () => void;
}

export function SwipeScreen({ dnaState, currentCard, domains, microText, onSwipe, onSeeMatches, onBack }: Props) {
  const [triggerSwipe, setTriggerSwipe] = useState<SwipeType | null>(null);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (triggerSwipe) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setTriggerSwipe('no');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setTriggerSwipe('yes');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setTriggerSwipe('love');
      }
    }
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [triggerSwipe]);

  return (
    <div className="dna-screen dna-swipe">
      {dnaState.completedOnboarding && (
        <button className="dna-back-link" onClick={onBack}>
          ← Back to recommendations
        </button>
      )}
      <div className="dna-topbar">
        <div className="dna-step-label">Step 2 of 3 — Flesh out your profile by swiping</div>
        <CalibrationMeter percent={dnaState.calibrationPercent} />
        <DomainBadgeRow completedDeepDives={dnaState.completedDeepDives} domains={domains} />
        <div className="dna-status-line">{calibrationStatusText(dnaState.calibrationPercent)}</div>
        {microText && <div className="dna-microupdate">{microText}</div>}
      </div>
      <div className="dna-card-stage">
        <SwipeCard
          key={currentCard.id}
          card={currentCard}
          onSwipe={onSwipe}
          triggerSwipe={triggerSwipe}
          onTriggerConsumed={() => setTriggerSwipe(null)}
        />
      </div>
      <div className="dna-swipe-buttons">
        <button className="dna-swipe-btn dna-no" onClick={() => setTriggerSwipe('no')} disabled={!!triggerSwipe}>
          <span className="dna-swipe-icon">✕</span>
          <span>No</span>
          <span className="dna-swipe-hint">←</span>
        </button>
        <button className="dna-swipe-btn dna-yes" onClick={() => setTriggerSwipe('yes')} disabled={!!triggerSwipe}>
          <span className="dna-swipe-icon">✓</span>
          <span>Yes</span>
          <span className="dna-swipe-hint">→</span>
        </button>
        <button className="dna-swipe-btn dna-love" onClick={() => setTriggerSwipe('love')} disabled={!!triggerSwipe}>
          <span className="dna-swipe-icon">♥</span>
          <span>Love it</span>
          <span className="dna-swipe-hint">↑</span>
        </button>
      </div>
      {dnaState.calibrationPercent >= 70 && (
        <button className="dna-link-btn" onClick={onSeeMatches}>
          See matches so far →
        </button>
      )}
    </div>
  );
}
