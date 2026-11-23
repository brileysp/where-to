'use client';

import { useState } from 'react';

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
