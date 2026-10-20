import { applySwipeToProfile } from '@/lib/dna/profile';
import type { DnaCard, PreferenceProfile } from '@/lib/dna/types';

/**
 * The photo picks (docs/onboarding-v2/SPEC.md 4.7), for people who skipped interests. Each pick nudges the app's own preference attributes
 * the way a "yes" on an experience card would, at double strength because a photo is a deliberate choice. The mockup draws gradients and
 * emoji; real photography replaces them later.
 */
export interface Vibe {
  key: string;
  label: string;
  emoji: string;
  gradient: string;
  signals: Record<string, number>;
}

export const VIBES: Vibe[] = [
  { key: 'beach', label: 'Toes in the sand', emoji: '🏖️', gradient: 'linear-gradient(135deg,#1c7c8a,#e9a95b)', signals: { beach: 1.5, relaxation: 0.5 } },
  { key: 'food', label: 'Long lunches and market crawls', emoji: '🍜', gradient: 'linear-gradient(135deg,#a8452c,#e0a24a)', signals: { food: 1.5, streetFood: 0.5 } },
  { key: 'hotel', label: 'A hotel you never want to leave', emoji: '🛎️', gradient: 'linear-gradient(135deg,#3b3f6e,#b58fc4)', signals: { luxury: 1.5, relaxation: 0.5 } },
  { key: 'trail', label: 'Trail dust and big views', emoji: '🏔️', gradient: 'linear-gradient(135deg,#2f5d44,#8aa6b8)', signals: { hiking: 1.5, remoteWilderness: 1, physicalChallenge: 0.5 } },
  { key: 'old', label: 'Old streets and big museums', emoji: '🏛️', gradient: 'linear-gradient(135deg,#6b4a2f,#c9a77a)', signals: { culture: 1.5, museums: 0.5, architecture: 0.5 } },
  { key: 'night', label: 'Rooftops and late nights', emoji: '🍸', gradient: 'linear-gradient(135deg,#271a4d,#c0407a)', signals: { nightlife: 1.5 } },
  { key: 'wild', label: 'Wild animals up close', emoji: '🐆', gradient: 'linear-gradient(135deg,#3d5a24,#c9a23a)', signals: { wildlife: 1.5, remoteWilderness: 0.5 } },
  { key: 'quiet', label: 'Total quiet', emoji: '🌿', gradient: 'linear-gradient(135deg,#1f4a4a,#7fb59a)', signals: { relaxation: 1, avoidingCrowds: 1.5, remoteWilderness: 0.5 } },
];

const VIBE_STRENGTH = 2;

/** One photo pick applied to a profile, as a "yes" at double strength. */
export function applyVibe(profile: PreferenceProfile, vibe: Vibe): PreferenceProfile {
  const scaled = Object.fromEntries(Object.entries(vibe.signals).map(([k, v]) => [k, v * VIBE_STRENGTH]));
  return applySwipeToProfile(profile, { preferenceSignals: scaled } as unknown as DnaCard, 'yes');
}
