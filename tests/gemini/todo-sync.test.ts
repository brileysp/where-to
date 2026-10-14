import { describe, expect, it } from 'vitest';
import { placeNameFromRewriteTitle } from '@/lib/gemini/todo-sync';

describe('placeNameFromRewriteTitle', () => {
  it('reads the current place name from a rename to-do', () => {
    expect(placeNameFromRewriteTitle('Rewrite Cuba for its wider scope (was Havana)')).toBe('Cuba');
    expect(placeNameFromRewriteTitle('Rewrite Phuket & the Andaman Coast for its narrower scope (was Thailand — Phuket & Islands)')).toBe('Phuket & the Andaman Coast');
  });
  it('ignores other to-dos', () => {
    expect(placeNameFromRewriteTitle('Check the drafted snorkeling & diving columns')).toBeNull();
  });
});
