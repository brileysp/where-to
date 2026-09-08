'use client';

import { useId } from 'react';
import { stampVisualFor, type StampShape } from '@/lib/scoring/stampVisual';

// Pointy-top hexagon, centered at (50,50) in a 100x100 viewBox.
const HEX_OUTER = '50,10 84.6,30 84.6,70 50,90 15.4,70 15.4,30';
const HEX_INNER = '50,18 77.7,34 77.7,66 50,82 22.3,66 22.3,34';

function scallopPoints(rBase: number, rBump: number, bumps: number): string {
  const steps = bumps * 2;
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rBase + rBump : rBase - rBump;
    pts.push(`${(50 + r * Math.cos(angle)).toFixed(1)},${(50 + r * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(' ');
}
const SCALLOP_OUTER = scallopPoints(40, 4, 14);

function ShapeGeometry({
  shape,
  stroke,
  outerWidth,
  innerWidth,
  dashed,
}: {
  shape: StampShape;
  stroke: string;
  outerWidth: number;
  innerWidth: number;
  dashed?: boolean;
}) {
  const outer = { fill: 'none', stroke, strokeWidth: outerWidth, strokeDasharray: dashed ? '6 5' : undefined };
  const inner = { fill: 'none', stroke, strokeWidth: innerWidth, strokeDasharray: dashed ? '6 5' : undefined };
  switch (shape) {
    case 'circle':
      return (
        <>
          <circle cx={50} cy={50} r={40} {...outer} />
          <circle cx={50} cy={50} r={31} {...inner} />
        </>
      );
    case 'rect':
      return (
        <>
          <rect x={7} y={25} width={86} height={50} rx={7} {...outer} />
          <rect x={16} y={33} width={68} height={34} rx={3} {...inner} />
        </>
      );
    case 'hex':
      return (
        <>
          <polygon points={HEX_OUTER} {...outer} />
          <polygon points={HEX_INNER} {...inner} />
        </>
      );
    case 'scallop':
      return (
        <>
          <polygon points={SCALLOP_OUTER} {...outer} />
          <circle cx={50} cy={50} r={28} {...inner} />
        </>
      );
    case 'oval':
    default:
      return (
        <>
          <ellipse cx={50} cy={50} rx={46} ry={33} {...outer} />
          <ellipse cx={50} cy={50} rx={37} ry={25} {...inner} />
        </>
      );
  }
}

/**
 * One design per location CODE (see stampVisualFor) — every destination in
 * the same country/state renders byte-for-byte the same stamp, the way a
 * real passport shows the same border-control design every time you enter
 * that country. Realism comes from two layered SVG filters: a roughen
 * pass (feTurbulence + feDisplacementMap) that only touches the ring/
 * border geometry, and a gentler ink-mottle pass (a second noise field
 * thresholded into an alpha mask) applied to both the border and the
 * text — mottle alone doesn't distort letterforms, so the code stays
 * readable even at list-row size, while still looking unevenly inked.
 */
export function StampBadge({
  destinationId,
  size = 30,
  ghost = false,
  popping = false,
}: {
  destinationId: string;
  size?: number;
  ghost?: boolean;
  popping?: boolean;
}) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const { code, shape, color, rotate, opacity, roughness, seed } = stampVisualFor(destinationId);

  if (ghost) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0, transform: `rotate(${rotate}deg)` }}>
        <ShapeGeometry shape={shape} stroke="var(--border)" outerWidth={3.4} innerWidth={1.8} dashed />
      </svg>
    );
  }

  const roughId = `stamp-rough-${uid}`;
  const inkId = `stamp-ink-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`stamp-ink${popping ? ' stamp-pop' : ''}`}
      style={
        {
          flexShrink: 0,
          transform: `rotate(${rotate}deg)`,
          opacity,
          '--stamp-rotate': `${rotate}deg`,
        } as React.CSSProperties
      }
    >
      <defs>
        <filter id={roughId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06 0.09" numOctaves={2} seed={seed} result="n1" />
          <feDisplacementMap in="SourceGraphic" in2="n1" scale={roughness * 3.2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={inkId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves={2} seed={seed + 17} result="n2" />
          <feComponentTransfer in="n2" result="mottle">
            <feFuncA type="linear" slope={2} intercept={-0.2} />
          </feComponentTransfer>
          <feComposite in="SourceGraphic" in2="mottle" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${inkId})`}>
        <g filter={`url(#${roughId})`}>
          <ShapeGeometry shape={shape} stroke={color} outerWidth={3.6} innerWidth={1.8} />
        </g>
        <text
          x="50"
          y="60"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight={800}
          fontSize={30}
          letterSpacing={1}
          fill={color}
        >
          {code}
        </text>
      </g>
    </svg>
  );
}
