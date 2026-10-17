import type { ReactNode } from 'react';

/** A panel that slides up from the bottom (spec 4.14). Dismissed by the dimmed area or the Done button. */
export function Sheet({ onClose, children, done = true }: { onClose: () => void; children: ReactNode; done?: boolean }) {
  return (
    <div className="ob2-sbg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ob2-sheet" role="dialog" aria-modal="true">
        {children}
        {done && (
          <button type="button" className="ob2-btn" onClick={onClose}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
