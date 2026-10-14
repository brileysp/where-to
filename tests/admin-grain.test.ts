import { describe, expect, it } from 'vitest';
import { grainLabel } from '@/lib/admin/interest-pages/grain';

describe('grainLabel', () => {
  it('uses the Place Grain Review scale', () => {
    expect(grainLabel(-3).label).toBe('Too specific');
    expect(grainLabel(-2).label).toBe('Too specific');
    expect(grainLabel(-1).label).toBe('Slightly specific');
    expect(grainLabel(0).label).toBe('Just right');
    expect(grainLabel(1).label).toBe('Slightly broad');
    expect(grainLabel(2).label).toBe('Too broad');
    expect(grainLabel(3).label).toBe('Too broad');
  });
});
