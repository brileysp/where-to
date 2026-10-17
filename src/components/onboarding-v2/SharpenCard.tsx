import { CATEGORY_VISUALS, DEFAULT_CATEGORY_VISUAL } from '@/lib/dna/card-visuals';
import type { SwipeType } from '@/lib/dna/types';
import { questionHint, type Question } from '@/lib/onboarding/questions';

/** The one question under the shortlist's header (spec 4.8): a tag, Skip, the card, three answers and a hint. */
export function SharpenCard({ question, onAnswer, onSkip }: { question: Question | null; onAnswer: (t: SwipeType) => void; onSkip: () => void }) {
  if (!question) {
    return (
      <div className="ob2-sq">
        <span className="tag">You are well calibrated</span>
        <h3>That is as sharp as it gets for now.</h3>
        <div className="hint">Teach us your taste with a few swipes, or save this to your Travel DNA.</div>
      </div>
    );
  }
  const visual = CATEGORY_VISUALS[question.card.category] ?? DEFAULT_CATEGORY_VISUAL;
  return (
    <div className="ob2-sq">
      <div className="row">
        <span className="tag">{question.lane ? `${visual.emoji} ${question.card.category} · expert lane` : 'Quick one'}</span>
        <button type="button" className="ob2-link" onClick={onSkip}>
          Skip
        </button>
      </div>
      <h3>{question.card.title}</h3>
      <div className="opts">
        <button type="button" onClick={() => onAnswer('no')}>No</button>
        <button type="button" onClick={() => onAnswer('yes')}>Yes</button>
        <button type="button" onClick={() => onAnswer('love')}>Love ♥</button>
      </div>
      <div className="hint">{questionHint(question)}</div>
    </div>
  );
}
