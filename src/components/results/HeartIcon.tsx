const HEART_PATH =
  'M10 17.5 3.5 11.2C1.3 9 1.3 5.6 3.5 3.5c2.1-2 5.4-1.9 7.4.2l.1.1.1-.1c2-2.1 5.3-2.2 7.4-.2 2.2 2.1 2.2 5.5 0 7.7L10 17.5z';

export function HeartIcon({ filled }: { filled: boolean }) {
  // The path's right lobe overshoots x=20 (its control points reach
  // ~20.6) — a 0 0 20 20 viewBox clips that sliver on every render,
  // which is why it looked cut off on both mobile and desktop. A small
  // uniform margin fixes it without touching the path itself.
  return (
    <svg viewBox="-1 -1 22 22" className={filled ? 'heart-filled' : 'heart-outline'}>
      <path d={HEART_PATH} />
    </svg>
  );
}
