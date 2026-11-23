import type { ReactNode } from 'react';

/** One quiet setting: its name, its current value ("Any" until something is chosen), and a chevron. It opens right under itself. Same pattern as the trip settings. */
export function SummaryRow({ title, value, set, open, onToggle, children }: { title: string; value: string; set: boolean; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`ob2-sr${open ? ' open' : ''}`}>
      <button type="button" className="srh" aria-expanded={open} onClick={onToggle}>
        <b>{title}</b>
        <span className={`sv${set ? ' set' : ''}`}>{value}</span>
        <i aria-hidden="true">{open ? '⌃' : '›'}</i>
      </button>
      {open && <div className="srb">{children}</div>}
    </div>
  );
}
