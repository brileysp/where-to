import { createHash } from 'crypto';

/** Stable sha256 hex digest — used for prompt_hash and input_context_hash on
 * content_generations rows. Object hashing sorts keys recursively first so
 * the same logical payload always hashes the same regardless of property
 * insertion order (JSON.stringify alone doesn't guarantee that). */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeysDeep(v)]),
    );
  }
  return value;
}

export function hashObject(value: unknown): string {
  return sha256(JSON.stringify(sortKeysDeep(value)));
}
