import type { DnaCard, SwipeType } from '@/lib/dna/types';
import { TasteCard } from '../TasteCard';

/** The Travel DNA path's five taste cards (spec 4.10). The cards are the app's own experience cards. */
export function CardsScreen({ card, done, index, total, onAnswer, onContinue }: { card: DnaCard | null; done: boolean; index: number; total: number; onAnswer: (t: SwipeType) => void; onContinue: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <h2>{done ? 'Five cards in.' : 'Which sounds like your kind of day?'}</h2>
        <p className="ob2-sub">{done ? 'That is enough for a first read.' : `Card ${index + 1} of ${total}. Go with your gut.`}</p>
        {done || !card ? (
          <div className="ob2-swcard">
            <div className="em" aria-hidden="true">✓</div>
            <b>Taste captured</b>
          </div>
        ) : (
          <TasteCard card={card} onAnswer={onAnswer} />
        )}
      </div>
      <div className="ob2-foot">
        {(done || !card) && (
          <button type="button" className="ob2-btn" onClick={onContinue}>
            Continue
          </button>
        )}
        {!done && card && (
          <button type="button" className="ob2-link" onClick={onContinue}>
            Skip the cards
          </button>
        )}
      </div>
    </>
  );
}
