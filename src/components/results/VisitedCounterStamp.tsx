'use client';

import { useId } from 'react';

const HEX_OUTER = '50,8 86.6,29 86.6,71 50,92 13.4,71 13.4,29';
const HEX_INNER = '50,17 78.5,33.5 78.5,66.5 50,83 21.5,66.5 21.5,33.5';

/**
 * The "places visited" counter, rendered as one fixed hexagonal ink stamp
 * in the app's own accent color — unlike destination stamps, this one
 * isn't tied to a place, so it never varies by shape, color, or wear. Font
 * size steps down for longer counts so three digits (up to all 200) never
 * gets tight against the ring.
 */
export function VisitedCounterStamp({ count, size = 46 }: { count: number; size?: number }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const roughId = `vcs-rough-${uid}`;
  const inkId = `vcs-ink-${uid}`;
  const digits = String(count).length;
  const fontSize = digits >= 3 ? 30 : digits === 2 ? 36 : 42;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="stamp-ink" style={{ transform: 'rotate(-4deg)', flexShrink: 0 }}>
      <defs>
        <filter id={roughId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.055 0.08" numOctaves={2} seed={7} result="n1" />
          <feDisplacementMap in="SourceGraphic" in2="n1" scale={4.5} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={inkId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves={2} seed={24} result="n2" />
          <feComponentTransfer in="n2" result="mottle">
            <feFuncA type="linear" slope={2.2} intercept={-0.15} />
          </feComponentTransfer>
          <feComposite in="SourceGraphic" in2="mottle" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${inkId})`}>
        <g filter={`url(#${roughId})`}>
          <polygon points={HEX_OUTER} fill="none" stroke="var(--accent)" strokeWidth={3.4} />
          <polygon points={HEX_INNER} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
        </g>
        <text
          x="50"
          y="59"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight={800}
          fontSize={fontSize}
          fill="var(--accent)"
        >
          {count}
        </text>
      </g>
    </svg>
  );
}
