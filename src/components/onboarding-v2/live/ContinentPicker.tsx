'use client';

import { useEffect, useState } from 'react';
import { REGION_KEYS, REGION_LABELS, REGION_RULES, allRegions, type RegionKey } from '@/lib/onboarding/regions';

const COLORS: Record<RegionKey, string> = { na: 'var(--rg-na)', csa: 'var(--rg-csa)', eu: 'var(--rg-eu)', af: 'var(--rg-af)', as: 'var(--rg-as)', oc: 'var(--rg-oc)' };

/** **bold** markers in the rules to real bold text. */
function bold(text: string) {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

/**
 * "Continents": a small map with no borders, six coloured shapes, all on to start. Tapping a shape or its pill turns that region off (grey);
 * "All" turns everything back on. At least one stays on. `on` is the list of regions that are on; an empty list means all.
 */
export function ContinentPicker({ on, onChange, onKeepOne }: { on: readonly RegionKey[]; onChange: (next: RegionKey[]) => void; onKeepOne?: () => void }) {
  const [map, setMap] = useState<{ paths: Record<RegionKey, string>; w: number; h: number } | null>(null);
  useEffect(() => {
    let live = true;
    import('@/lib/onboarding/world-map-data').then((m) => { if (live) setMap({ paths: m.REGION_PATHS, w: m.MAP_WIDTH, h: m.MAP_HEIGHT }); });
    return () => { live = false; };
  }, []);
  const all = allRegions(on);
  const current: RegionKey[] = all ? [...REGION_KEYS] : REGION_KEYS.filter((k) => on.includes(k));
  const isOn = (k: RegionKey) => current.includes(k);

  function toggle(k: RegionKey) {
    if (isOn(k)) {
      if (current.length === 1) { onKeepOne?.(); return; }
      onChange(current.filter((x) => x !== k));
    } else onChange(REGION_KEYS.filter((x) => isOn(x) || x === k));
  }

  return (
    <div className="lq-cont">
      <div className="lq-mapbox">
        {map ? (
          <svg viewBox={`0 0 ${map.w} ${map.h}`} role="img" aria-label="World map of the six regions. Tap a region to turn it off or on.">
            {REGION_KEYS.map((k) => (
              <path key={k} d={map.paths[k]} fill={isOn(k) ? COLORS[k] : 'var(--rg-off)'} stroke={isOn(k) ? COLORS[k] : 'var(--rg-off)'} strokeWidth=".7" strokeLinejoin="round" onClick={() => toggle(k)}>
                <title>{REGION_LABELS[k]}</title>
              </path>
            ))}
          </svg>
        ) : (
          <div className="lq-mapph" aria-hidden="true" />
        )}
      </div>
      <div className="lq-seg" style={{ marginTop: 8 }}>
        <button type="button" className={`lq-tp sm${all ? ' on' : ''}`} aria-pressed={all} onClick={() => onChange([])}>All</button>
        {REGION_KEYS.map((k) => (
          <button key={k} type="button" className={`lq-tp reg${isOn(k) ? ' on' : ''}`} aria-pressed={isOn(k)} onClick={() => toggle(k)}>
            <i style={{ background: isOn(k) ? COLORS[k] : 'var(--rg-off)' }} />
            {REGION_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="lq-hint" style={{ marginTop: 6 }}>{all ? 'All continents are on. Tap one to leave it out.' : `${current.length} of ${REGION_KEYS.length} on. Tap All to turn everything back on.`}</div>
      <details className="lq-rules">
        <summary>How we draw the lines</summary>
        <ul>
          {REGION_RULES.map((r) => (
            <li key={r}>{bold(r)}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
