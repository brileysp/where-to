import { useRef } from 'react';
import { interestByKey, interestsInGroup, nextUnseenGroup, pickerGroups, relatedFor, type PickerInterest } from '@/lib/onboarding/interests';
import { getOnboardingSettings } from '@/lib/onboarding/settings';
import type { Levels } from '@/lib/onboarding/levels';
import { useFlip } from '../useFlip';

/** "What do you love to do?" (spec 4.4): four sliding category tabs and a grid of interest boxes. No search, no subhead. */

function InterestBox({ i, on, onToggle }: { i: PickerInterest; on: boolean; onToggle: (k: string) => void }) {
  return (
    <button type="button" className={`ob2-ib ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onToggle(i.key)}>
      <span className="ie" aria-hidden="true">{i.icon}</span>
      <span className="lb">{i.label}</span>
    </button>
  );
}

export function LoveScreen({
  levels,
  group,
  seen,
  more,
  dnaMode,
  onToggle,
  onGroup,
  onMore,
  onSkip,
  onContinue,
}: {
  levels: Levels;
  group: string;
  seen: Record<string, boolean>;
  more: Record<string, boolean>;
  dnaMode: boolean;
  onToggle: (key: string) => void;
  onGroup: (g: string, scrollTop?: boolean) => void;
  onMore: (g: string) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useFlip(root);
  const groups = pickerGroups();
  const picked = Object.keys(levels).filter((k) => interestByKey(k));
  const n = picked.length;
  const count = (g: string) => picked.filter((k) => interestByKey(k)!.group === g).length;
  const list = interestsInGroup(group);
  const limit = getOnboardingSettings().interestsPerCategory;
  const showAll = !!more[group];
  const shown = showAll ? list : list.slice(0, limit);
  const related = relatedFor(picked);
  const next = nextUnseenGroup(groups.map((g) => g.name), group, seen);
  const nextIcon = groups.find((g) => g.name === next)?.icon;

  return (
    <>
      <div className="ob2-scr" ref={root}>
        <h2>What do you love to do?</h2>
        <div className="ob2-lbl" style={{ margin: '0 0 -4px' }}>Browse interests in 4 categories</div>
        <div className="ob2-gtabs" role="tablist">
          {groups.map((g) => {
            const c = count(g.name);
            const collapsed = c > 0 && g.name !== group;
            return (
              <button
                key={g.name}
                type="button"
                role="tab"
                aria-selected={g.name === group}
                className={`ob2-gt ${g.name === group ? 'on' : ''} ${collapsed ? 'col' : ''}`}
                data-fw={g.name}
                aria-label={`${g.name}${c ? `, ${c} picked` : ''}`}
                onClick={() => onGroup(g.name)}
              >
                <span className="gi" aria-hidden="true">{g.icon}</span>
                {!collapsed && <span className="gl">{g.name}</span>}
                {c > 0 && <i>{c}</i>}
              </button>
            );
          })}
        </div>
        <div className="ob2-gname">{group}</div>
        <div className="ob2-ig">
          {shown.map((i) => (
            <InterestBox key={i.key} i={i} on={!!levels[i.key]} onToggle={onToggle} />
          ))}
        </div>
        {list.length > limit && (
          <button type="button" className="ob2-link" onClick={() => onMore(group)}>
            {showAll ? 'Show fewer' : `Show ${list.length - limit} more`}
          </button>
        )}
        {related.length > 0 && (
          <>
            <div className="ob2-lbl">People who pick these often add</div>
            <div className="ob2-chips">
              {related.map((s) => (
                <button key={s.key} type="button" className="ob2-chip sug" onClick={() => onToggle(s.key)}>
                  + {s.icon} {s.label}
                </button>
              ))}
            </div>
          </>
        )}
        {next && (
          <button type="button" className="ob2-btn ghost contg" onClick={() => onGroup(next, true)}>
            <span>{nextIcon} Continue to {next}</span>
            <i aria-hidden="true">›</i>
          </button>
        )}
      </div>
      <div className="ob2-foot">
        {n > 0 && (
          <div className="ob2-tray">
            <b>{n} picked</b>
            <span>
              {picked.slice(0, 7).map((k) => interestByKey(k)!.icon).join(' ')}
              {n > 7 ? ` +${n - 7}` : ''}
            </span>
          </div>
        )}
        <button type="button" className="ob2-btn" disabled={n === 0} onClick={onContinue}>
          {n ? 'Continue' : 'Pick at least one'}
        </button>
        {!dnaMode && (
          <button type="button" className="ob2-link" onClick={onSkip}>
            Skip, I have no favorites
          </button>
        )}
      </div>
    </>
  );
}
