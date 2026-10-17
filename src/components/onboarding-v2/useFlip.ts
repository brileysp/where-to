import { useLayoutEffect, type RefObject } from 'react';

/**
 * Smooth movement when things change place or size, the same way the mockup does it (and the live results page):
 *  - an element with data-flip="key" that moves up or down slides from its old position over 480 ms;
 *  - an element with data-fw="key" that gets wider or narrower animates its width over 280 ms.
 * Runs after every render of the owner, comparing with the positions it recorded last time (measured on the page, so scrolling alone never
 * counts as movement). The first render never animates.
 */
export function useFlip(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const prev = (root as HTMLElement & { __flip?: { tops: Record<string, number>; widths: Record<string, number> } }).__flip;
    const tops: Record<string, number> = {};
    const widths: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((e) => {
      tops[e.dataset.flip!] = e.getBoundingClientRect().top + window.scrollY;
    });
    root.querySelectorAll<HTMLElement>('[data-fw]').forEach((e) => {
      widths[e.dataset.fw!] = e.getBoundingClientRect().width;
    });
    if (prev && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.querySelectorAll<HTMLElement>('[data-flip]').forEach((e) => {
        const before = prev.tops[e.dataset.flip!];
        if (before == null) return;
        const dy = before - tops[e.dataset.flip!];
        if (Math.abs(dy) > 2) e.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
      root.querySelectorAll<HTMLElement>('[data-fw]').forEach((e) => {
        const before = prev.widths[e.dataset.fw!];
        if (before == null) return;
        const w = widths[e.dataset.fw!];
        if (Math.abs(before - w) > 2) {
          e.style.overflow = 'hidden';
          e.animate([{ width: `${before}px` }, { width: `${w}px` }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      });
    }
    (root as HTMLElement & { __flip?: unknown }).__flip = { tops, widths };
  });
}
