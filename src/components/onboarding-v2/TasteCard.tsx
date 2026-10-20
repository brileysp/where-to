import { CATEGORY_VISUALS, DEFAULT_CATEGORY_VISUAL } from '@/lib/dna/card-visuals';
import type { DnaCard, SwipeType } from '@/lib/dna/types';

/** One experience card with No / Yes / Love buttons (spec 4.10, and the five-swipe sheet). */
export function TasteCard({ card, onAnswer }: { card: DnaCard; onAnswer: (t: SwipeType) => void }) {
  const visual = CATEGORY_VISUALS[card.category] ?? DEFAULT_CATEGORY_VISUAL;
  return (
    <>
      <div className="ob2-swcard">
        <div className="em" aria-hidden="true">{visual.emoji}</div>
        <b>{card.title}</b>
      </div>
      <div className="ob2-swbtns">
        <button type="button" onClick={() => onAnswer('no')}>No</button>
        <button type="button" onClick={() => onAnswer('yes')}>Yes</button>
        <button type="button" className="love" onClick={() => onAnswer('love')}>Love ♥</button>
      </div>
    </>
  );
}
