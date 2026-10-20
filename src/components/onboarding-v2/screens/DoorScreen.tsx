import { canContinueFromDoor, type DoorKey, type Doors } from '@/lib/onboarding/path';

/** The first screen (spec 4.1): two A-or-B questions that decide which screens come next. */

interface Option {
  key: DoorKey;
  icon: string;
  title: string;
  detail: string;
}

const BUILT_AROUND: Option[] = [
  { key: 'love', icon: '🎯', title: 'Something I love to do', detail: 'Specific interests like hiking, diving, birding, golf…' },
  { key: 'open', icon: '✨', title: 'Just give me a great trip', detail: 'Surprise me' },
];
const TIMING: Option[] = [
  { key: 'window', icon: '🗓️', title: 'A specific time window', detail: 'Exact weeks, or flight logistics' },
  { key: 'flex', icon: '🌤️', title: 'My timing is flexible', detail: 'Just pick a month' },
];

function Question({ heading, options, doors, onChoose }: { heading: string; options: Option[]; doors: Doors; onChoose: (k: DoorKey) => void }) {
  return (
    <div className="ob2-qb">
      <h3>{heading}</h3>
      <div className="ob2-tiles">
        {options.map((o) => (
          <button key={o.key} type="button" className={`ob2-tile ${doors[o.key] ? 'on' : ''}`} aria-pressed={doors[o.key]} onClick={() => onChoose(o.key)}>
            <span className="ic" aria-hidden="true">{o.icon}</span>
            <span className="tx">
              <b>{o.title}</b>
              <span>{o.detail}</span>
            </span>
            <span className="chk" aria-hidden="true">{doors[o.key] ? '✓' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DoorScreen({ doors, onChoose, onContinue, onDnaFirst }: { doors: Doors; onChoose: (k: DoorKey) => void; onContinue: () => void; onDnaFirst: () => void }) {
  return (
    <>
      <div className="ob2-scr">
        <div className="ob2-brand">Where To?</div>
        <h2>Let us plan a trip</h2>
        <p className="ob2-sub">Two quick choices. They only decide which questions come next.</p>
        <Question heading="What should the trip be built around?" options={BUILT_AROUND} doors={doors} onChoose={onChoose} />
        <Question heading="How fixed is your timing?" options={TIMING} doors={doors} onChoose={onChoose} />
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" disabled={!canContinueFromDoor(doors)} onClick={onContinue}>
          Continue
        </button>
        <button type="button" className="ob2-link strong" onClick={onDnaFirst}>
          Not planning a trip yet? Build my Travel DNA instead
        </button>
      </div>
    </>
  );
}
