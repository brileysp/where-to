import { describe, expect, it } from 'vitest';
import { loadSkipList } from '../../src/lib/gemini/skip-list';

describe('whale watching clear N/A skip list', () => {
  const list = loadSkipList('whaleWatching');
  it('has the 74 skipped places, each with a reason', () => {
    expect(list.size).toBe(74);
    for (const [id, reason] of list) expect(reason.length, id).toBeGreaterThan(5);
  });
  it('skips the clear N/A and the owner-chosen borderline places', () => {
    for (const id of ['yellowstone', 'bhutan', 'luangprabang', 'paris', 'rioja', 'queenstown', 'joshua-tree', 'north-cascades']) expect(list.has(id), id).toBe(true);
  });
  it('never skips a place that sits on a coast or has whale text', () => {
    for (const id of ['hudson-valley', 'london', 'rome', 'napa', 'lisbon', 'azores', 'hokkaido', 'borneo', 'cambodia', 'angkor']) expect(list.has(id), id).toBe(false);
  });
  it('is empty for an interest with no list', () => {
    expect(loadSkipList('birding').size).toBe(0);
  });
});

describe('snorkeling & diving clear N/A skip list', () => {
  const list = loadSkipList('diving');
  it('has the 55 skipped places, each with a reason', () => {
    expect(list.size).toBe(55);
    for (const [id, reason] of list) expect(reason.length, id).toBeGreaterThan(5);
  });
  it('skips landlocked and far-inland places', () => {
    for (const id of ['yellowstone', 'bhutan', 'nepal', 'paris', 'rwanda', 'uyuni', 'zion-bryce']) expect(list.has(id), id).toBe(true);
  });
  it('never skips a place with a coast, a reef or a notable lake, spring or wreck draw', () => {
    for (const id of ['banff', 'chicago', 'texas-hill-country', 'pantanal', 'swissalps', 'antarctica', 'tuscany', 'jordan', 'vermont', 'upper-peninsula', 'rajaampat', 'london']) expect(list.has(id), id).toBe(false);
  });
});
