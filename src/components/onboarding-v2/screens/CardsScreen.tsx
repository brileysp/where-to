import { useEffect, useRef } from 'react';
import type { DnaCard, SwipeType } from '@/lib/dna/types';
import { TasteCard } from '../TasteCard';

/** The Travel DNA path's five taste cards (spec 4.10). The cards are the app's own experience cards. */
export function CardsScreen({ card, done, index, total, onAnswer, onContinue }: { card: DnaCard | null; done: boolean; index: number; total: number; onAnswer: (t: SwipeType) => void; onContinue: () => void }) {
  const finished = done || !card;
  // After the last card there is nothing left to decide, so it moves on by itself (owner, 22 Nov 2026).
  const next = useRef(onContinue);
  useEffect(() => {
    next.current = onContinue;
  });
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => next.current(), 1500);
    return () => clearTimeout(t);
  }, [finished]);
  return (
    <>
      <div className="ob2-scr">
        <h2>{done ? 'Five cards in.' : 'Which sounds like your kind of day?'}</h2>
        {finished ? (
          <p className="ob2-sub">That is enough for a first read.</p>
        ) : (
          <div className="ob2-dots" role="img" aria-label={`Card ${index + 1} of ${total}`}>
            {Array.from({ length: total }, (_, k) => (
              <i key={k} className={k <= index ? 'd' : ''} />
            ))}
          </div>
        )}
        {finished ? (
          <div className="ob2-swcard">
            <div className="ob2-spin" aria-hidden="true" />
            <b>Building your DNA…</b>
          </div>
        ) : (
          <TasteCard card={card} onAnswer={onAnswer} />
        )}
      </div>
      <div className="ob2-foot">
        {!finished && card && (
          <button type="button" className="ob2-link" onClick={onContinue}>
            Skip the cards
          </button>
        )}
      </div>
    </>
  );
}
