import { describe, expect, it } from 'vitest';
import { emphasisIsBalanced, splitEmphasis, stripEmphasis } from '@/lib/text/emphasis';

describe('species-name emphasis', () => {
  it('strips markers', () => {
    expect(stripEmphasis('The **Azores Bullfinch** and **Cory\'s Shearwaters** nest here.')).toBe("The Azores Bullfinch and Cory's Shearwaters nest here.");
  });
  it('splits into ordered parts', () => {
    expect(splitEmphasis('See **Grant\'s gazelle** now')).toEqual([
      { text: 'See ', emphasis: false },
      { text: "Grant's gazelle", emphasis: true },
      { text: ' now', emphasis: false },
    ]);
  });
  it('leaves plain text alone', () => {
    expect(splitEmphasis('No names here.')).toEqual([{ text: 'No names here.', emphasis: false }]);
  });
  it('detects unbalanced or empty markers and never shows stray asterisks', () => {
    expect(emphasisIsBalanced('a **b** c')).toBe(true);
    expect(emphasisIsBalanced('a **b c')).toBe(false);
    expect(emphasisIsBalanced('a **** c')).toBe(false);
    expect(splitEmphasis('a **b c').map((p) => p.text).join('')).toBe('a b c');
  });
});
