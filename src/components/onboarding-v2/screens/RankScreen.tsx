import { getOnboardingSettings } from '@/lib/onboarding/settings';
import { Fragment, useRef } from 'react';
import { interestByKey } from '@/lib/onboarding/interests';
import { orderedByLevel, type Levels } from '@/lib/onboarding/levels';
import type { OnboardingChip } from '@/lib/db/queries/onboarding-chips';
import { useFlip } from '../useFlip';

/** "Top interests" (spec 4.5): tap a row to make it a top interest; a top interest opens a "What kind?" row of its specifics. */
export function RankScreen({
  levels,
  chips,
  subs,
  onStar,
  onSpecific,
  onContinue,
  onBack,
}: {
  levels: Levels;
  chips: Record<string, OnboardingChip[]>;
  subs: Record<string, string[]>;
  onStar: (key: string) => void;
  onSpecific: (interest: string, chip: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useFlip(root);
  const rows = orderedByLevel(levels).filter((k) => interestByKey(k));
  // Headers only once something is starred, so the jump to the top reads as a group (owner, 22 Nov 2026).
  const hasTop = rows.some((k) => levels[k] === 'top');
  const firstOther = rows.find((k) => levels[k] !== 'top');
  return (
    <>
      <div className="ob2-scr" ref={root}>
        <h2>Top interests</h2>
        <p className="ob2-sub">Pick up to {getOnboardingSettings().maxTopInterests}, the most important ones for travel</p>
        <div className="ob2-rows">
          {rows.map((k) => {
            const i = interestByKey(k)!;
            const on = levels[k] === 'top';
            const ch = chips[k] ?? [];
            const pick = subs[k] ?? [];
            return (
              <Fragment key={k}>
              {hasTop && k === rows[0] && on && <div className="ob2-grp">Top interests</div>}
              {hasTop && k === firstOther && <div className="ob2-grp">Also picked</div>}
              <div className={`ob2-rk ${on ? 'on top' : ''}`} data-flip={k}>
                <button type="button" className="rkh" aria-pressed={on} onClick={() => onStar(k)}>
                  <span className="e" aria-hidden="true">{i.icon}</span>
                  <b>{i.label}</b>
                  <span className="st">{on ? '★ Top interest' : '☆'}</span>
                </button>
                {on && ch.length > 0 && (
                  <div className="rks">
                    <div className="ob2-rkl">What kind?</div>
                    <div className="ob2-chips">
                      {ch.map((c) => (
                        <button key={c.key} type="button" className={`ob2-chip sc ${pick.includes(c.key) ? 'on' : ''}`} aria-pressed={pick.includes(c.key)} onClick={() => onSpecific(k, c.key)}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="ob2-foot">
        <button type="button" className="ob2-btn" onClick={onContinue}>
          Continue
        </button>
        <button type="button" className="ob2-link" onClick={onBack}>
          Back to add more
        </button>
      </div>
    </>
  );
}
