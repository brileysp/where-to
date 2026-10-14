'use client';

import { useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { COUNTRY_CODES } from '@/lib/units/countries';
import { setHomeCountry } from '@/app/units-actions';
import { useUnits } from './UnitsProvider';

/** "Home country" setting: decides °F or °C, miles or km and feet or metres everywhere text with measurements is shown. */
export function HomeCountryPicker({ className }: { className?: string }) {
  const { country, units } = useUnits();
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = useMemo(() => {
    const names = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    return COUNTRY_CODES.map((c) => ({ code: c, name: names?.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const summary = `${units.temp === 'F' ? '°F' : '°C'} · ${units.distance === 'mi' ? 'miles' : 'km'} · ${units.length === 'ft' ? 'feet' : 'metres'}`;
  return (
    <label className={className} title={`Home country. Sets how temperatures and distances are shown: ${summary}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span aria-hidden="true">🌍</span>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Home country</span>
      <select
        value={country ?? ''}
        disabled={pending}
        aria-label="Home country"
        onChange={(e) => { const code = e.target.value; if (code) start(async () => { await setHomeCountry(code); router.refresh(); }); }}
        style={{ font: 'inherit', fontSize: 12, maxWidth: 150, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border-strong, #c1c7b8)', background: 'var(--bg-panel, #fff)', color: 'inherit' }}
      >
        {!country && <option value="">Home country…</option>}
        {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
      </select>
      <span style={{ opacity: 0.65, whiteSpace: 'nowrap' }}>{summary}</span>
    </label>
  );
}
