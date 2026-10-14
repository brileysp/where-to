import { describe, expect, it } from 'vitest';
import { shortInterestLabel } from '@/lib/scoring/shortName';

describe('shortInterestLabel', () => {
  it('takes the text before " & " when no pill name is set', () => {
    expect(shortInterestLabel('Snorkeling & Diving')).toBe('Snorkeling');
    expect(shortInterestLabel('Birding')).toBe('Birding');
  });
  it('uses the admin pill name when there is one', () => {
    expect(shortInterestLabel('Cycling - Road & Gravel Biking', 'Cycling')).toBe('Cycling');
  });
  it('treats an empty pill name as not set', () => {
    expect(shortInterestLabel('Hiking & Trekking', '')).toBe('Hiking');
  });
});
