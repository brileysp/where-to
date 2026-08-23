import { useState } from 'react';
import { PERSONAS } from '@/lib/scoring/constants';

// When a preset persona is active, this shows the full picker normally —
// that's the ordinary pre-DNA flow. When Travel DNA (or a saved profile)
// is driving the sliders instead, showing 4 equally-weighted cards with
// none highlighted read as broken/confusing, so it collapses down to one
// quiet, low-emphasis link instead — nobody who just spent 5 minutes
// swiping is looking to immediately abandon that for a generic preset,
// so this option deliberately doesn't compete for attention.
export function PersonaPicker({
  activePersonaId,
  collapsed,
  onSelect,
}: {
  activePersonaId: string | null;
  collapsed: boolean;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(!collapsed);

  if (!expanded) {
    return (
      <button type="button" className="persona-collapsed-link" onClick={() => setExpanded(true)}>
        Or choose a preset travel style instead →
      </button>
    );
  }

  return (
    <div className="panel">
      <h2>Pick a starting point</h2>
      <div className="persona-grid">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`persona-card${p.id === activePersonaId ? ' active' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <div className="persona-icon">{p.icon}</div>
            <div className="persona-name">{p.name}</div>
            <div className="persona-blurb">{p.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
