import { InterestGrid } from '../InterestGrid';

interface Props {
  picked: string[];
  onToggle: (key: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function StyleShortcutScreen({ picked, onToggle, onContinue, onBack }: Props) {
  return (
    <div className="dna-screen dna-style-shortcut">
      <h1>Pick what looks good</h1>
      <p className="dna-basics-sub">
        A quick starting point instead of swiping — pick as many as you like and we&apos;ll build a rough profile from
        them. You can refine it with sliders anytime, or come back and build your full Travel DNA later.
      </p>
      <InterestGrid picked={picked} onToggle={onToggle} />
      <button className="btn-primary" onClick={onContinue}>
        Build my starting point
      </button>
      <button className="dna-link-btn" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}
