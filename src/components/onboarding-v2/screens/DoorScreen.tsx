import { canContinueFromDoor, doorButtonLabel, doorSecondShown, type DoorKey, type Doors } from '@/lib/onboarding/path';

/** The first screen (spec 4.1): two A-or-B questions that decide which screens come next. */

interface Option {
  key: DoorKey;
  icon: string;
  title: string;
  detail: string;
  /** The quieter choice: shown muted and with a dashed border, so the full flow is the obvious one. */
  soft?: boolean;
}

const BUILT_AROUND: Option[] = [
  { key: 'love', icon: '🎯', title: 'Something I love to do', detail: 'Hiking, birding, diving, food…' },
  // 21 Nov 2026 (owner): the personal flow is the one we want people to take, so this choice is plain and honest about the trade-off.
  { key: 'open', icon: '🎲', title: 'Just show me ideas', detail: 'Quicker, but less personal', soft: true },
];
const TIMING: Option[] = [
  { key: 'window', icon: '🗓️', title: 'A specific time window', detail: 'Exact weeks and trip length' },
  { key: 'flex', icon: '🌤️', title: 'My timing is flexible', detail: 'Just pick a month' },
];

function Question({ step, heading, options, doors, onChoose, reveal }: { step: string; heading: string; options: Option[]; doors: Doors; onChoose: (k: DoorKey) => void; reveal?: boolean }) {
  return (
    <div className={`ob2-qb${reveal ? ' ob2-reveal' : ''}`}>
      <h3>
        <small className="ob2-step">{step}</small>
        {heading}
      </h3>
      <div className="ob2-tiles tight">
        {options.map((o) => (
          <button key={o.key} type="button" className={`ob2-tile ${doors[o.key] ? 'on' : ''}${o.soft ? ' soft' : ''}`} aria-pressed={doors[o.key]} onClick={() => onChoose(o.key)}>
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
        <h2>Let us plan a trip</h2>
        <Question step="1 of 2" heading="What should the trip be built around?" options={BUILT_AROUND} doors={doors} onChoose={onChoose} />
        {doorSecondShown(doors) && <Question step="2 of 2" heading="How fixed is your timing?" options={TIMING} doors={doors} onChoose={onChoose} reveal />}
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" disabled={!canContinueFromDoor(doors)} onClick={onContinue}>
          {doorButtonLabel(doors)}
        </button>
        <button type="button" className="ob2-link strong" onClick={onDnaFirst}>
          Not planning a trip yet? Build my Travel DNA instead
        </button>
      </div>
    </>
  );
}
