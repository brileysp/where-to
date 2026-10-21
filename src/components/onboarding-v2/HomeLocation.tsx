'use client';

import { useMemo } from 'react';
import { airportByCode } from '@/lib/onboarding/airports';
import { HOME_COUNTRIES, airportsFor, hasSubStep, resolveOrigin, subChoices, subLabel } from '@/lib/onboarding/origin';
import { HomePicker } from './HomePicker';

/** Everything the home pickers need, passed around as one thing. */
export interface HomeBundle {
  country: string | null;
  sub: string | null;
  airport: string | null;
  onCountry: (code: string) => void;
  onSub: (code: string) => void;
  onPickAirport: (code: string) => void;
  onClearAirport: () => void;
}

/** The value that means "none of the listed countries": the airport search takes over. */
export const ELSEWHERE = 'ZZ';

/**
 * Where you live (spec 5.4, extended): pick a country; for the United States a state, for Canada a province or territory; then optionally a
 * big airport near you. A country that is not listed uses the airport search. Flights are estimated from the most exact thing chosen.
 */
export function HomeLocation({
  country,
  sub,
  airport,
  onCountry,
  onSub,
  onPickAirport,
  onClearAirport,
}: {
  country: string | null;
  sub: string | null;
  airport: string | null;
  onCountry: (code: string) => void;
  onSub: (code: string) => void;
  onPickAirport: (code: string) => void;
  onClearAirport: () => void;
}) {
  const countries = useMemo(() => [...HOME_COUNTRIES].sort((a, b) => (a[0] === 'US' ? -1 : b[0] === 'US' ? 1 : a[0] === 'CA' ? -1 : b[0] === 'CA' ? 1 : a[1].localeCompare(b[1]))), []);
  const choices = subChoices(country);
  const near = airportsFor(country, sub);
  const elsewhere = country === ELSEWHERE;
  const origin = resolveOrigin({ airport, country: elsewhere ? null : country, sub });
  const chosen = airportByCode(airport);
  function hint(): string {
    if (!origin) {
      if (elsewhere) return 'Type a city or airport code.';
      if (hasSubStep(country)) return `Choose your ${subLabel(country).toLowerCase()} so we can estimate flights.`;
      return 'Choose where you live so we can estimate flights.';
    }
    if (chosen) return 'We estimate flights from your airport.';
    const exact = near.length ? ' Pick an airport to be exact.' : '';
    if (country === 'US') return `We estimate flights from the middle of ${origin.label}.${exact}`;
    if (country === 'CA') {
      const [city, province] = origin.label.split(', ');
      return `We estimate flights from ${city}, the main city of ${province}.${exact}`;
    }
    return `We estimate flights from ${origin.label}'s main city.`;
  }
  return (
    <div className="ob2-home">
      <select className="ob2-sel" aria-label="Country" value={country ?? ''} onChange={(e) => e.target.value && onCountry(e.target.value)}>
        {!country && <option value="">Choose your country</option>}
        {countries.map((c) => (
          <option key={c[0]} value={c[0]}>{c[1]}</option>
        ))}
        <option value={ELSEWHERE}>Somewhere else…</option>
      </select>
      {hasSubStep(country) && (
        <select className="ob2-sel" aria-label={subLabel(country)} value={sub ?? ''} onChange={(e) => onSub(e.target.value)}>
          <option value="">{`Choose your ${subLabel(country).toLowerCase()}`}</option>
          {choices.map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      )}
      {elsewhere && <HomePicker home={airport} onPick={onPickAirport} onClear={onClearAirport} />}
      {!elsewhere && near.length > 0 && (
        <>
          <div className="ob2-lbl">Nearest big airport (optional)</div>
          <div className="ob2-chips">
            {near.map((a) => (
              <button key={a.code} type="button" className={`ob2-chip ${airport === a.code ? 'on' : ''}`} aria-pressed={airport === a.code} onClick={() => (airport === a.code ? onClearAirport() : onPickAirport(a.code))}>
                {a.city} {a.code}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="ob2-fine">{hint()}</div>
    </div>
  );
}
