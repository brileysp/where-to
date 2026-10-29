'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A long blurb shows two and a half lines, with the half line fading out so you can see there is more, and a "Read more" link opens it (tap the
 * text, or the link, again to close it). A blurb that fits in two and a half lines is shown whole, with no fade and no link. The collapsed height
 * follows the blurb's own line height, so it adjusts with the phone's text size.
 */
export function CollapsibleBlurb({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [cap, setCap] = useState<number | null>(null);
  const [full, setFull] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      const collapsed = Math.round(lh * 2.5);
      setFull(el.scrollHeight);
      setCap(el.scrollHeight > collapsed + 2 ? collapsed : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const folded = cap !== null && !open;
  return (
    <div className="cb">
      <p
        ref={ref}
        className={`${className ?? ''} cb-text${folded ? ' cb-fade' : ''}${cap !== null ? ' cb-clip' : ''}`}
        style={cap !== null ? { maxHeight: open ? full : cap } : undefined}
        onClick={cap !== null ? () => setOpen((o) => !o) : undefined}
      >
        {children}
      </p>
      {cap !== null && (
        <button type="button" className="cb-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span>{open ? 'Show less' : 'Read more'}</span>
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 4.2 6 8l4-3.8" />
          </svg>
        </button>
      )}
    </div>
  );
}
