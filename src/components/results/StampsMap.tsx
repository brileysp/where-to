'use client';

import { useEffect, useState } from 'react';
import { buildEqualEarth, type EqualEarthMap } from '@/lib/onboarding/world-map-equal-earth';

export interface StampPin {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * The My Stamps map (owner picks, 23 Nov 2026): an empty world map in the Equal Earth projection, and one small red round-headed pushpin with a soft shadow for each place
 * marked visited. Nothing is drawn for a place that has not been visited. No names or emoji on the map; tapping a pin names it underneath.
 */
export function StampsMap({ pins }: { pins: StampPin[] }) {
  const [map, setMap] = useState<EqualEarthMap | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import('@/lib/onboarding/world-map-data').then((m) => {
      if (live) setMap(buildEqualEarth(m.REGION_PATHS, 720));
    });
    return () => {
      live = false;
    };
  }, []);
  if (!map) return <div className="stamps-map stamps-map-wait" aria-hidden="true" />;
  const placed = pins.map((p) => ({ p, at: map.project(p.lon, p.lat) })).sort((a, b) => a.at[1] - b.at[1]);
  const chosen = sel ? pins.find((p) => p.id === sel) : null;
  return (
    <div className="stamps-map-wrap">
      <div className="stamps-map">
        <svg viewBox={`0 0 ${map.width} ${map.height}`} role="img" aria-label={`World map with ${pins.length} pin${pins.length === 1 ? '' : 's'}, one for each place you have visited`}>
          {Object.entries(map.paths).map(([k, d]) => (
            <path key={k} d={d} fill="#e6dfc8" stroke="#cfc6a8" strokeWidth=".6" strokeLinejoin="round" />
          ))}
          {placed.map(({ p, at }) => (
            <g key={p.id} transform={`translate(${at[0]} ${at[1]}) scale(${sel === p.id ? 1.6 : 1})`} className="stamps-pin" onClick={() => setSel(sel === p.id ? null : p.id)}>
              <title>{p.name}</title>
              <ellipse cx="2" cy="-0.9" rx="4.1" ry="1.4" fill="#000" opacity=".22" />
              <line x1="0" y1="0" x2="0" y2="-6.3" stroke="#8a8a8a" strokeWidth=".9" />
              <circle cx="0" cy="-8.55" r="4.68" fill="#d23b32" stroke="#a3231c" strokeWidth=".7" />
              <circle cx="-1.4" cy="-10" r="1.35" fill="#fff" opacity=".7" />
            </g>
          ))}
        </svg>
      </div>
      {chosen && <div className="stamps-map-sel">{chosen.name}</div>}
    </div>
  );
}
