'use client';

import { useEffect, useState } from 'react';

// Reveals once the scroll target (the results heading, where search lives)
// has scrolled fully above the viewport — not a fixed pixel threshold — so
// it adapts to however tall the sidebar happens to be (it varies a lot
// between collapsed/expanded sliders on the stacked mobile layout).
export function BackToTopButton({ targetRef }: { targetRef: React.RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const el = targetRef.current;
      if (!el) return;
      setVisible(el.getBoundingClientRect().bottom < 0);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [targetRef]);

  function handleClick() {
    const el = targetRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 12;
    // Not 'smooth': window.scrollTo with smooth behavior has already
    // proven unreliable elsewhere in this app (see the month-panel scroll
    // in ResultsApp.tsx) — it silently fails to complete in some cases.
    window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
  }

  return (
    <button
      type="button"
      className={`back-to-top-btn${visible ? ' visible' : ''}`}
      onClick={handleClick}
      aria-label="Back to search, at the top"
    >
      ↑
    </button>
  );
}
