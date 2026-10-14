'use client';

import { createContext, useCallback, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { imperialToDisplay, type Units } from '@/lib/text/units';
import { syncHomeCountry } from '@/app/units-actions';

interface UnitsValue { country: string | null; units: Units }
const UnitsContext = createContext<UnitsValue>({ country: null, units: { temp: 'F', distance: 'mi', length: 'ft' } });

/** Gives every screen the visitor's units (from their home country), and on the first visit checks their account for a saved country. */
export function UnitsProvider({ country, source, units, children }: { country: string | null; source: 'saved' | 'auto' | 'unset'; units: Units; children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (source !== 'unset') return;
    syncHomeCountry().then((r) => { if (r.country) router.refresh(); }).catch(() => {});
  }, [source, router]);
  return <UnitsContext.Provider value={{ country, units }}>{children}</UnitsContext.Provider>;
}

export const useUnits = () => useContext(UnitsContext);

/** Text is stored in US units; this shows it in the visitor's. Returns a function so one hook serves a whole component. */
export function useUnitText(): (text: string) => string {
  const { units } = useUnits();
  return useCallback((text: string) => imperialToDisplay(text, units), [units]);
}
