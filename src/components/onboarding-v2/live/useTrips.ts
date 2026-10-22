'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteTrip, saveTrip } from '@/app/onboarding-v2/trip-actions';
import type { Bands, CareState } from '@/lib/onboarding/care';
import type { RegionKey } from '@/lib/onboarding/regions';
import type { TripLength } from '@/lib/onboarding/trip-length';
import { effectiveTrip, makeTripId, newTrip, overridesFor, withMonth, withName, withYear, type EffectiveTrip, type Trip } from '@/lib/onboarding/trips';

/** The working copy of the active trip: what the screens read and change. */
export interface TripWork {
  month: number | null;
  week: number;
  length: TripLength | null;
  continents: RegionKey[];
  who: string[];
  bands: Bands;
  care: CareState;
  maxHours: number;
}

/** What the traveler's profile says for the choices a trip can change (the defaults a trip inherits). */
export interface TripDefaults {
  who: string[];
  bands: Bands;
  care: CareState;
  maxHours: number;
}

export interface TripsArgs {
  initial: Trip[];
  first: string | null;
  /** Saving starts once the traveler is on the results, so a trip is not saved halfway through the onboarding. */
  enabled: boolean;
  work: TripWork;
  defaults: TripDefaults;
  /** Puts a trip's settings into the screens' working copy. */
  apply: (t: Trip, eff: EffectiveTrip) => void;
  toast: (m: string) => void;
}

/**
 * Several trips at once. The screens keep working on one set of values (`work`); this keeps the list of trips, which one is active, and saves the
 * active one a moment after it changes. Switching or starting a trip loads its settings into the working copy.
 */
export function useTrips(a: TripsArgs) {
  const [trips, setTrips] = useState<Trip[]>(() => {
    if (a.initial.length) return a.initial;
    return [newTrip({ id: makeTripId(), first: a.first, month: a.work.month, length: a.work.length, continents: a.work.continents, week: a.work.week })];
  });
  const [activeId, setActiveId] = useState(trips[0].id);

  const stored = trips.find((t) => t.id === activeId) ?? trips[0];
  /** The active trip as it stands now: its saved details with the working copy laid over them (the name and year follow the month until set by hand). */
  const current: Trip = useMemo(() => {
    const base = stored.month === a.work.month ? stored : withMonth(stored, a.work.month, a.first);
    return {
      ...base,
      month: a.work.month,
      week: a.work.week,
      length: a.work.length,
      continents: a.work.continents,
      overrides: overridesFor(a.defaults, { who: a.work.who, bands: a.work.bands, care: a.work.care, maxHours: a.work.maxHours }),
    };
  }, [stored, a.first, a.work, a.defaults]);

  const all = useMemo(() => trips.map((t) => (t.id === activeId ? current : t)), [trips, activeId, current]);

  // Save a moment after the active trip changes (not before the results, and not on the very first render).
  const lastSaved = useRef(JSON.stringify(a.initial.find((t) => t.id === activeId) ?? null));
  const sig = JSON.stringify(current);
  useEffect(() => {
    if (!a.enabled || sig === lastSaved.current) return;
    const t = setTimeout(async () => {
      lastSaved.current = sig;
      const r = await saveTrip(JSON.parse(sig));
      if (!r.ok) a.toast(r.message);
    }, 700);
    return () => clearTimeout(t);
  }, [sig, a.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  function remember(t: Trip) {
    setTrips((list) => list.map((x) => (x.id === t.id ? t : x)));
  }
  const rename = (name: string) => remember(withName(current, name, a.first));
  const setYear = (year: number) => remember(withYear(current, year, a.first));

  async function flush(): Promise<void> {
    if (!a.enabled || JSON.stringify(current) === lastSaved.current) return;
    lastSaved.current = JSON.stringify(current);
    await saveTrip(current);
  }

  async function switchTo(id: string) {
    if (id === activeId) return;
    const target = trips.find((t) => t.id === id);
    if (!target) return;
    await flush();
    remember(current);
    lastSaved.current = JSON.stringify(target);
    setActiveId(id);
    a.apply(target, effectiveTrip(a.defaults, target));
    if (a.enabled) saveTrip(target); // brings it to the front: the most recently saved trip is the active one
  }

  async function create(): Promise<void> {
    await flush();
    const t = newTrip({ id: makeTripId(), first: a.first, month: null });
    setTrips((list) => [...list.map((x) => (x.id === activeId ? current : x)), t]);
    setActiveId(t.id);
    lastSaved.current = '';
    a.apply(t, effectiveTrip(a.defaults, t));
  }

  async function remove(id: string): Promise<void> {
    if (trips.length <= 1) return;
    if (a.enabled) {
      const r = await deleteTrip(id);
      if (!r.ok) {
        a.toast(r.message);
        return;
      }
    }
    const rest = trips.filter((t) => t.id !== id);
    setTrips(rest);
    if (id === activeId) {
      const next = rest[0];
      setActiveId(next.id);
      lastSaved.current = JSON.stringify(next);
      a.apply(next, effectiveTrip(a.defaults, next));
    }
  }

  return { trips: all, active: current, activeId, rename, setYear, switchTo, create, remove };
}

export type TripsApi = ReturnType<typeof useTrips>;
