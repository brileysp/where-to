import { useState } from 'react';
import { airportByCode, searchAirports } from '@/lib/onboarding/airports';

/**
 * The home city or airport picker (spec 5.4): one choice, typed. Shows up to six matches as you type; choosing one shows a filled chip with
 * a Change link.
 */
export function HomePicker({ home, onPick, onClear }: { home: string | null; onPick: (code: string) => void; onClear: () => void }) {
  const [text, setText] = useState('');
  const chosen = airportByCode(home);
  if (chosen) {
    return (
      <div className="ob2-hpset">
        <span className="hpc">
          📍 <b>{chosen.city}</b> <em>{chosen.code}</em>
        </span>
        <button type="button" className="ob2-link" onClick={onClear}>
          Change
        </button>
      </div>
    );
  }
  const q = text.trim();
  const hits = searchAirports(text);
  return (
    <div className="ob2-hp">
      <input type="search" placeholder="Type a city or airport code" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" aria-label="Home city or airport" />
      {q.length < 2 ? (
        <div className="ob2-fine">Start typing a city, like “San”, or an airport code like “JFK”.</div>
      ) : hits.length ? (
        <div className="ob2-hpl">
          {hits.map((a) => (
            <button
              key={a.code}
              type="button"
              className="hpo"
              onClick={() => {
                onPick(a.code);
                setText('');
              }}
            >
              <span>
                <b>{a.city}</b>
                <small>{a.region}</small>
              </span>
              <em>{a.code}</em>
            </button>
          ))}
        </div>
      ) : (
        <div className="ob2-fine">No airport found for “{q}”. Try the nearest big city.</div>
      )}
    </div>
  );
}
