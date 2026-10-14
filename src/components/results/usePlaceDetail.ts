'use client';

import { useEffect, useState } from 'react';
import { loadPlaceDetail } from '@/app/actions';
import type { PlaceDetailText } from '@/lib/scoring/types';

// One fetch per place per visit: the text of a place already opened is kept in memory, and a fetch already under way is shared.
const done = new Map<string, PlaceDetailText | null>();
const pending = new Map<string, Promise<PlaceDetailText | null>>();

function fetchDetail(id: string): Promise<PlaceDetailText | null> {
  let p = pending.get(id);
  if (!p) {
    p = loadPlaceDetail(id)
      .then((d) => {
        done.set(id, d);
        return d;
      })
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}

/** Start loading a place's text before its sheet opens (for example when a card is touched). */
export function prefetchPlaceDetail(id: string): void {
  if (!done.has(id)) void fetchDetail(id).catch(() => {});
}

/** The text of one place: `loading` until it arrives, then `detail` (null if the place has none or the fetch failed). */
export function usePlaceDetail(id: string): { detail: PlaceDetailText | null; loading: boolean } {
  const [state, setState] = useState<{ id: string; detail: PlaceDetailText | null; loaded: boolean }>(() => ({ id, detail: done.get(id) ?? null, loaded: done.has(id) }));
  useEffect(() => {
    if (done.has(id)) return;
    let live = true;
    fetchDetail(id)
      .then((d) => live && setState({ id, detail: d, loaded: true }))
      .catch(() => live && setState({ id, detail: null, loaded: true }));
    return () => {
      live = false;
    };
  }, [id]);
  const current = state.id === id ? state : { id, detail: done.get(id) ?? null, loaded: done.has(id) };
  return { detail: current.detail, loading: !current.loaded };
}
