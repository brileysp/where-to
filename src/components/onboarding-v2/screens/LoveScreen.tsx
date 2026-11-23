import { useEffect, useRef, useState } from 'react';
import { interestByKey, interestsInGroup, nextUnseenGroup, pickerGroups, shortGroupName, type PickerInterest } from '@/lib/onboarding/interests';
import type { Levels } from '@/lib/onboarding/levels';
import { useFlip } from '../useFlip';

/** "What do you love to do?" (spec 4.4): four sliding category tabs and a grid of every interest in the chosen category (no "show more", no suggestions). */

/** The emoji line above the Done button: as many picked interests as fit the width, then "+N" for the rest (never a "..."). */
function Tray({ icons }: { icons: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ITEM = 21;
  const MORE = 38;
  const fit = !width || icons.length * ITEM <= width ? icons.length : Math.max(0, Math.floor((width - MORE) / ITEM));
  return (
    <div className="ob2-tray" ref={ref} aria-label={`${icons.length} picked`}>
      {icons.slice(0, fit).map((e, i) => (
        <span key={i} className="em" aria-hidden="true">{e}</span>
      ))}
      {icons.length > fit && <b className="more">+{icons.length - fit}</b>}
    </div>
  );
}

/** Slides a row sideways with our own easing, so it works the same in every browser (the built-in smooth scrolling is not dependable on a row like this). */
function slideTo(row: HTMLElement, left: number): void {
  const from = row.scrollLeft;
  const to = Math.max(0, Math.min(left, row.scrollWidth - row.clientWidth));
  if (Math.abs(to - from) < 1) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { row.scrollLeft = to; return; }
  const t0 = performance.now();
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / 260);
    row.scrollLeft = from + (to - from) * (1 - Math.pow(1 - k, 3));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Space kept clear to the right of the chosen tab, past the fade at the row's edge. */
const TAB_MARGIN = 28;

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
  dnaMode,
  onToggle,
  onGroup,
  onSkip,
  onContinue,
}: {
  levels: Levels;
  group: string;
  seen: Record<string, boolean>;
  dnaMode: boolean;
  onToggle: (key: string) => void;
  onGroup: (g: string, scrollTop?: boolean) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  useFlip(root);
  const groups = pickerGroups();
  const picked = Object.keys(levels).filter((k) => interestByKey(k));
  const n = picked.length;
  const count = (g: string) => picked.filter((k) => interestByKey(k)!.group === g).length;
  const list = interestsInGroup(group);
  const next = nextUnseenGroup(groups.map((g) => g.name), group, seen);
  const nextIcon = groups.find((g) => g.name === next)?.icon;

  // Keeps the chosen category's tab fully in view, with its count: when the row scrolls sideways (the last category), the picks made there widen the tab.
  const countSig = groups.map((g) => count(g.name)).join(',');
  useEffect(() => {
    const row = tabs.current;
    if (!row) return;
    const run = () => {
      const el = row.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!el) return;
      const r = row.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      // Choosing a tab brings the one after it into view as well, so the next category is always in sight (Culture slides Relaxation in).
      const after = (el.nextElementSibling as HTMLElement | null)?.getBoundingClientRect() ?? e;
      const right = after.right - r.left + row.scrollLeft + TAB_MARGIN - row.clientWidth;
      if (right > row.scrollLeft) slideTo(row, right);
      else if (e.left - r.left < 0) slideTo(row, Math.max(0, e.left - r.left + row.scrollLeft - TAB_MARGIN));
    };
    run();
    const t = setTimeout(run, 330);
    return () => clearTimeout(t);
  }, [group, countSig]);

  return (
    <>
      <div className="ob2-scr ob2-lovescr" ref={root}>
        <div className="ob2-lovehd">
          <h2>What do you love to do?</h2>
          {!dnaMode && (
            <button type="button" className="ob2-link plain skip" onClick={onSkip}>
              Skip
            </button>
          )}
        </div>
        <div className="ob2-pick">Pick your interests in 4 categories</div>
        <div className="ob2-gtabs" role="tablist" ref={tabs}>
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
                {!collapsed && <span className="gl">{shortGroupName(g.name)}</span>}
                {c > 0 && <i>{c}</i>}
              </button>
            );
          })}
        </div>
        <div className="ob2-gname">{group} – {groups.findIndex((g) => g.name === group) + 1} of {groups.length}</div>
        <div className="ob2-ig">
          {list.map((i) => (
            <InterestBox key={i.key} i={i} on={!!levels[i.key]} onToggle={onToggle} />
          ))}
        </div>
        {next && (
          <button type="button" className="ob2-btn ghost contg" onClick={() => onGroup(next, true)}>
            <span>{nextIcon} Continue to {next}</span>
            <i aria-hidden="true">›</i>
          </button>
        )}
      </div>
      <div className="ob2-foot ob2-float">
        <div className="fl-card">
          {n > 0 && <Tray icons={picked.map((k) => interestByKey(k)!.icon)} />}
          <button type="button" className="ob2-btn" disabled={n === 0} onClick={onContinue}>
            {n ? `Done, ${n} picked` : 'Pick at least one'}
          </button>
        </div>
      </div>
    </>
  );
}
