const BOOKMARK_PATH = 'M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16l-6-4-6 4V4z';

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={filled ? 'bookmark-filled' : 'bookmark-outline'}>
      <path d={BOOKMARK_PATH} />
    </svg>
  );
}
