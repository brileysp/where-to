import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/indigenous-cultures-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;

describe('Indigenous Cultures evidence', () => {
  it('covers all 61 places with an evidence line per column', () => {
    expect(Object.keys(draft)).toHaveLength(61);
    for (const [p, d] of Object.entries(draft)) for (const l of ['Indigenous-led tours:', 'Homestays:', 'Living traditions and ceremonies: left blank']) expect(d.evidence as string, `${p} ${l}`).toContain(l);
  });
  it('every tick names its operator, a test or page, and a confidence', () => {
    for (const [p, d] of Object.entries(draft)) {
      const ev = d.evidence as string;
      if (d.indigenousLed) expect(ev, p).toMatch(/Indigenous-led tours: ticked\..*Test: .*Source: https?:\/\/\S+ \(confidence (high|medium|low)\)/);
      else expect(ev, p).toContain('Indigenous-led tours: left blank');
      if (d.communityHomestay) expect(ev, p).toMatch(/Homestays: ticked\..*Source: https?:\/\/\S+ \(confidence (high|medium|low)\)/);
      else expect(ev, p).toContain('Homestays: left blank');
    }
  });
  it('the living-traditions rating is left blank everywhere', () => {
    for (const [p, d] of Object.entries(draft)) expect(d.livingTraditions, p).toBeUndefined();
  });
  it('distance follows the stated tiers and matches the straight-line figure in the evidence', () => {
    for (const [p, d] of Object.entries(draft)) {
      const m = /How far to reach: (near|day|remote)\..*? is (\d+) km in a straight line/.exec(d.evidence as string);
      if (!d.reachDistance) { expect(m, p).toBeNull(); continue; }
      expect(m, p).not.toBeNull();
      const km = Number(m![2]);
      expect(d.reachDistance, p).toBe(km < 100 ? 'near' : km <= 400 ? 'day' : 'remote');
    }
  });
  it('a place with no verified experience has no list or distance filled', () => {
    for (const [p, d] of Object.entries(draft)) {
      if (!d.indigenousLed && !d.communityHomestay) for (const k of ['exchangeDepth', 'stayStandard', 'reachDistance']) expect(d[k], `${p} ${k}`).toBeUndefined();
    }
  });
  it('keeps the checked anchors', () => {
    for (const p of ['peruvian-amazon', 'tasmania', 'uluru', 'vancouver-island', 'queenstown']) expect(draft[p].indigenousLed, p).toBe(true);
    for (const p of ['sedona', 'yellowstone', 'rwanda', 'greenland']) expect(draft[p].indigenousLed, p).toBeUndefined();
    expect(draft['uluru'].reachDistance).toBe('remote');
    expect(draft['nepal'].reachDistance).toBe('near');
  });
});
