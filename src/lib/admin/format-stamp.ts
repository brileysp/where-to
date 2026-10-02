import type { ContentStamp } from '@/lib/db/schema';

/** One compact, human-readable line for a ContentStamp — who most recently
 * touched this, when, why, and (only when it actually changed hands) who it
 * started with. Shared by the Matrix CSV export and the admin grid's own
 * badges so the two surfaces never describe the same stamp differently. */
export function formatStamp(stamp: ContentStamp | null | undefined): string {
  if (!stamp) return '';
  const date = stamp.lastEditedAt.slice(0, 10);
  const chainNote = stamp.origin !== stamp.lastEditedBy ? ` [was ${stamp.origin}]` : '';
  const reasonNote = stamp.lastChange ? `: ${stamp.lastChange}` : '';
  return `${stamp.lastEditorName} (${date})${chainNote}${reasonNote}`;
}

export function stampIcon(kind: ContentStamp['lastEditedBy'] | undefined): string {
  if (kind === 'gemini') return '🤖';
  if (kind === 'claude') return '🧠';
  if (kind === 'human') return '👤';
  return '';
}
