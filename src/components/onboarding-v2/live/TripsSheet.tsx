'use client';

import { useState } from 'react';
import { REGION_LABELS } from '@/lib/onboarding/regions';
import { TRIP_LENGTHS } from '@/lib/onboarding/trip-length';
import { tripSummary, type Trip } from '@/lib/onboarding/trips';
import type { TripsApi } from './useTrips';

export const PENCIL = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.8 2.7a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5 2.5 13.5l1-3.1z" />
  </svg>
);

/** The trip's name, with a pencil to change it. Typing then Enter, or tapping away, saves; Escape cancels. */
export function TripName({ name, onRename, big }: { name: string; onRename: (n: string) => void; big?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  function done(save: boolean) {
    if (save && text.trim() !== name) onRename(text);
    setEditing(false);
  }
  if (editing) {
    return (
      <input
        className="lq-nameinp"
        value={text}
        maxLength={60}
        autoFocus
        aria-label="Trip name"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => done(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') done(true);
          if (e.key === 'Escape') done(false);
        }}
      />
    );
  }
  return (
    <>
      {big ? <h3 className="lq-tname-h">{name}</h3> : <b className="lq-tname-b">{name}</b>}
      <button type="button" className="lq-pen" aria-label="Rename trip" onClick={() => { setText(name); setEditing(true); }}>
        {PENCIL}
      </button>
    </>
  );
}

/** "Your trips": every saved trip with a short summary; tap one to switch to it. New trip, rename and delete live here too. */
export function TripsSheet({ api, onClose, onNew }: { api: TripsApi; onClose: () => void; onNew: () => void }) {
  const [sure, setSure] = useState<string | null>(null);
  return (
    <div className="ob2-sbg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ob2-sheet lq-trip" role="dialog" aria-modal="true" aria-label="Your trips">
        <div className="lq-triphd">
          <h3>Your trips</h3>
          <button type="button" className="lq-link" onClick={onClose}>Done</button>
        </div>
        <div className="lq-tripbody">
          {api.trips.map((t: Trip) => (
            <div key={t.id} className={`lq-tripitem${t.id === api.activeId ? ' on' : ''}`}>
              <button type="button" className="lq-tripdot" aria-label={`Switch to ${t.name}`} onClick={() => { api.switchTo(t.id); onClose(); }}>
                {t.id === api.activeId ? '✓' : ''}
              </button>
              {t.id === api.activeId ? (
                <div className="lq-tripsel"><TripName name={t.name} onRename={api.rename} /></div>
              ) : (
                <button type="button" className="lq-tripsel" onClick={() => { api.switchTo(t.id); onClose(); }}>
                  <b className="lq-tname-b">{t.name}</b>
                </button>
              )}
              {api.trips.length > 1 && (
                <button type="button" className="lq-link" onClick={() => (sure === t.id ? (api.remove(t.id), setSure(null)) : setSure(t.id))}>
                  {sure === t.id ? 'Sure?' : 'Delete'}
                </button>
              )}
              <small className="lq-tripsum">{tripSummary(t, (l) => TRIP_LENGTHS.find((x) => x.key === l)!.label, (k) => REGION_LABELS[k])}</small>
            </div>
          ))}
          <div className="lq-hint" style={{ marginTop: 10 }}>Interests, Travel DNA and where you live are shared by every trip.</div>
        </div>
        <div className="lq-tripft">
          <button type="button" className="ob2-btn" onClick={onNew}>+ New trip</button>
        </div>
      </div>
    </div>
  );
}
