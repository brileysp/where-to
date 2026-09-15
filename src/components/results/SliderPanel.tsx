'use client';

import { SLIDERS, VISIBLE_SLIDERS, SLIDER_GROUPS, PERSONAS } from '@/lib/scoring/constants';
import { getStyleLabel, getStyleAxisName } from '@/lib/dna/domains';
import type { SavedProfileData } from '@/app/actions';

function weightsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  return SLIDERS.every((s) => (a[s.key] || 0) === (b[s.key] || 0));
}

interface Props {
  weights: Record<string, number>;
  onSliderChange: (key: string, value: number) => void;
  showAllSliders: boolean;
  onToggleShowAll: () => void;
  activePersonaId: string | null;
  savedProfiles: SavedProfileData[];
  onSelectProfile: (id: string) => void;
  onSaveProfile: () => void;
  onDeleteProfile: () => void;
  onReset: () => void;
  earnedStyles: Record<string, string[]>;
  selectedStyles: Record<string, string[]>;
  onToggleStyle: (sliderKey: string, styleKey: string) => void;
}

export function SliderPanel({
  weights,
  onSliderChange,
  showAllSliders,
  onToggleShowAll,
  activePersonaId,
  savedProfiles,
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile,
  onReset,
  earnedStyles,
  selectedStyles,
  onToggleStyle,
}: Props) {
  const activePersona = PERSONAS.find((p) => p.id === activePersonaId);
  const matchedProfile = savedProfiles.find((p) => weightsEqual(p.weights, weights));

  const visibleGroups = showAllSliders
    ? SLIDER_GROUPS.map((g) => ({ group: g, sliders: VISIBLE_SLIDERS.filter((s) => s.group === g) }))
    : [{ group: null, sliders: VISIBLE_SLIDERS.filter((s) => (activePersona ? activePersona.primary.includes(s.key) : true)) }];

  return (
    <div className="panel">
      <h2>Interests</h2>
      <div className="profile-row">
        <select
          value={matchedProfile?.id ?? ''}
          onChange={(e) => {
            if (e.target.value) onSelectProfile(e.target.value);
          }}
        >
          <option value="">{matchedProfile ? matchedProfile.name : 'Custom (unsaved)'}</option>
          {savedProfiles
            .filter((p) => p.id !== matchedProfile?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={onSaveProfile}>
          Save current as…
        </button>
        {matchedProfile && (
          <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={onDeleteProfile}>
            Delete
          </button>
        )}
      </div>

      {visibleGroups.map(({ group, sliders }) => (
        <div key={group ?? 'primary'}>
          {group && <div className="slider-group-header">{group.toUpperCase()}</div>}
          {sliders.map((s) => {
            const earned = earnedStyles[s.key] || [];
            const selected = selectedStyles[s.key] || [];
            return (
              <div key={s.key} className="slider-row">
                <div className="slider-top">
                  <span className="slider-label">
                    <span className="slider-icon">{s.icon}</span>
                    {s.label}
                  </span>
                  <span className="slider-val">{weights[s.key] ?? 0}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={weights[s.key] ?? 0}
                  onChange={(e) => onSliderChange(s.key, Number(e.target.value))}
                />
                {earned.length > 0 &&
                  (() => {
                    // Group pills by axis (e.g. Terrain vs Night Sky) so
                    // multiple axes sharing one slider don't render as
                    // one undifferentiated row — only show the axis
                    // caption when there's more than one distinct axis
                    // among the earned pills, so single-axis domains
                    // (Cycling) look exactly as before.
                    const axisNames = Array.from(new Set(earned.map((k) => getStyleAxisName(s.key, k))));
                    const showAxisLabels = axisNames.length > 1;
                    return axisNames.map((axisName) => (
                      <div key={axisName} className="style-pill-group">
                        {showAxisLabels && <div className="style-pill-group-label">{axisName}</div>}
                        <div className="style-pill-row" role="group" aria-label={`${s.label} ${axisName} styles`}>
                          {earned
                            .filter((styleKey) => getStyleAxisName(s.key, styleKey) === axisName)
                            .map((styleKey) => {
                              const isSelected = selected.includes(styleKey);
                              const isLastSelected = isSelected && selected.length === 1;
                              return (
                                <button
                                  key={styleKey}
                                  type="button"
                                  className={`style-pill${isSelected ? ' style-pill-selected' : ''}`}
                                  aria-pressed={isSelected}
                                  disabled={isLastSelected}
                                  title={isLastSelected ? 'At least one style must stay selected' : undefined}
                                  onClick={() => {
                                    const next = isSelected ? selected.filter((k) => k !== styleKey) : [...selected, styleKey];
                                    if (!next.length) return;
                                    onToggleStyle(s.key, styleKey);
                                  }}
                                >
                                  {getStyleLabel(s.key, styleKey)}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ));
                  })()}
              </div>
            );
          })}
        </div>
      ))}

      <button type="button" className="btn-secondary" onClick={onToggleShowAll}>
        {showAllSliders ? 'Show fewer sliders' : `Show all ${VISIBLE_SLIDERS.length} sliders`}
      </button>
      <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
