import { PERSONAS, SLIDERS, SLIDER_GROUPS, VISIBLE_SLIDERS, sliderState } from './constants';

/**
 * Admin edits laid over the code-defined interest list and personas (constants.ts). Client-safe: the database is read in
 * overridesServer.ts and the result is handed to the browser as a prop, then applied to the same shared SLIDERS and PERSONAS arrays
 * on both sides, so server render and hydration agree and every reader (the engine, the pickers, the admin screens) sees the edit.
 */
export interface InterestOverride {
  label?: string | null;
  group?: string | null;
  hidden?: boolean | null;
  audienceTier?: string | null;
  /** Position in the picker, lower first. */
  order?: number | null;
}
export interface PersonaOverride {
  name?: string | null;
  icon?: string | null;
  blurb?: string | null;
  primary?: string[] | null;
  weights?: Record<string, number>;
}
export interface Overrides {
  interests: Record<string, InterestOverride>;
  personas: Record<string, PersonaOverride>;
}

export const AUDIENCE_TIER_VALUES = ['iconic', 'popular', 'enthusiast', 'specialist'] as const;
export const EMPTY_OVERRIDES: Overrides = { interests: {}, personas: {} };

interface SliderOriginal { label: string; group: string; hidden: boolean | undefined; audienceTier: string; index: number }
interface PersonaOriginal { name: string; icon: string; blurb: string; primary: string[]; weights: Record<string, number> }

let originalSliders: Map<string, SliderOriginal> | null = null;
let originalPersonas: Map<string, PersonaOriginal> | null = null;
let appliedKey = '';

function capture() {
  if (originalSliders && originalPersonas) return;
  originalSliders = new Map(SLIDERS.map((s, index) => [s.key, { label: s.label, group: s.group, hidden: s.hidden, audienceTier: s.audienceTier, index }]));
  originalPersonas = new Map(PERSONAS.map((p) => [p.id, { name: p.name, icon: p.icon, blurb: p.blurb, primary: [...p.primary], weights: { ...p.weights } }]));
}

/** The built-in values, for the admin screens to show beside an override. */
export function builtInSlider(key: string): SliderOriginal | undefined {
  capture();
  return originalSliders!.get(key);
}
export function builtInPersona(id: string): PersonaOriginal | undefined {
  capture();
  return originalPersonas!.get(id);
}

/** Puts the overrides on SLIDERS, VISIBLE_SLIDERS and PERSONAS in place. Safe to call on every render: nothing happens when they have not changed. */
export function applyOverrides(o: Overrides): void {
  capture();
  const key = JSON.stringify(o);
  if (key === appliedKey) return;
  appliedKey = key;

  for (const s of SLIDERS) {
    const base = originalSliders!.get(s.key)!;
    const ov = o.interests[s.key] ?? {};
    s.label = ov.label?.trim() ? ov.label.trim() : base.label;
    s.group = ov.group && SLIDER_GROUPS.includes(ov.group) ? ov.group : base.group;
    s.hidden = ov.hidden === null || ov.hidden === undefined ? base.hidden : ov.hidden;
    s.audienceTier = ov.audienceTier && (AUDIENCE_TIER_VALUES as readonly string[]).includes(ov.audienceTier) ? (ov.audienceTier as typeof s.audienceTier) : (base.audienceTier as typeof s.audienceTier);
  }
  // Re-order in place: an override's order is a position; interests without one keep their built-in position.
  const position = (s: (typeof SLIDERS)[number]) => o.interests[s.key]?.order ?? originalSliders!.get(s.key)!.index + 1;
  const sorted = [...SLIDERS].sort((a, b) => position(a) - position(b) || originalSliders!.get(a.key)!.index - originalSliders!.get(b.key)!.index);
  SLIDERS.splice(0, SLIDERS.length, ...sorted);
  VISIBLE_SLIDERS.splice(0, VISIBLE_SLIDERS.length, ...SLIDERS.filter((s) => !s.hidden));

  for (const p of PERSONAS) {
    const base = originalPersonas!.get(p.id)!;
    const ov = o.personas[p.id] ?? {};
    p.name = ov.name?.trim() ? ov.name.trim() : base.name;
    p.icon = ov.icon?.trim() ? ov.icon.trim() : base.icon;
    p.blurb = ov.blurb?.trim() ? ov.blurb.trim() : base.blurb;
    p.primary = ov.primary && ov.primary.length ? [...ov.primary] : [...base.primary];
    p.weights = { ...base.weights, ...(ov.weights ?? {}) };
  }
  sliderState.version++;
}
