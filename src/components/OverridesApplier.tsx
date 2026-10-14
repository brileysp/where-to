'use client';

import { applyOverrides, type Overrides } from '@/lib/scoring/overrides';

/**
 * Applies the admin overrides of the interest list and personas to this browser's copy of the shared arrays. It renders before the page,
 * so everything below it reads the edited values. The server applies the same overrides first, so server render and hydration match.
 */
export function OverridesApplier({ overrides }: { overrides: Overrides }) {
  applyOverrides(overrides);
  return null;
}
