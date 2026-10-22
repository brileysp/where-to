import { VIBES } from './vibes';

/**
 * A traveler who skipped the interest picker and chose photos instead still gets the shortlist's own questions. The photos point to
 * interests; this works out which ones to ask about. Only interests the caller says are fine (an everyday audience, not the specialist tier,
 * and with questions to ask) count, so nobody is quizzed on something only experts would know. The first interests are shared out across the
 * photos in turn, so each photo is represented, and there are never more than `max` (the number the question shares are planned for).
 */
export function interestsFromVibes(vibes: readonly string[], allowed: (interest: string) => boolean, max = 5): string[] {
  const lists = vibes.flatMap((v) => {
    const found = VIBES.find((x) => x.key === v);
    return found ? [found.interests.filter(allowed)] : [];
  });
  const out: string[] = [];
  for (let round = 0; out.length < max; round++) {
    let any = false;
    for (const list of lists) {
      const k = list[round];
      if (k === undefined) continue;
      any = true;
      if (!out.includes(k) && out.length < max) out.push(k);
    }
    if (!any) break;
  }
  return out;
}

/** When there are no photo picks either ("surprise me"), the questions are about the interests most travelers share. */
export const DEFAULT_START_INTERESTS = ['scenicLandscapes', 'beachesSwimming', 'cityExploration', 'historyArchaeology', 'streetFood'];

/** The interests to start a traveler with who chose none: from the photos, or the common ones when there are no photos. */
export function startingInterests(vibes: readonly string[], allowed: (interest: string) => boolean, max = 5): string[] {
  const fromPhotos = interestsFromVibes(vibes, allowed, max);
  return fromPhotos.length ? fromPhotos : DEFAULT_START_INTERESTS.filter(allowed).slice(0, max);
}
