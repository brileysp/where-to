import { describe, expect, it } from 'vitest';
import { loadSkipList } from '../../src/lib/gemini/skip-list';
import { PLACE } from '@/lib/places/keys.generated';

describe('whale watching clear N/A skip list', () => {
  const list = loadSkipList('whaleWatching');
  it('has the 74 skipped places, each with a reason', () => {
    expect(list.size).toBe(74);
    for (const [id, reason] of list) expect(reason.length, id).toBeGreaterThan(5);
  });
  it('skips the clear N/A and the owner-chosen borderline places', () => {
    for (const id of [PLACE['yellowstone-national-park'], PLACE.bhutan, PLACE.laos, PLACE.paris, PLACE.rioja, PLACE.queenstown, PLACE['palm-springs-and-joshua-tree'], PLACE['north-cascades']]) expect(list.has(id), id).toBe(true);
  });
  it('never skips a place that sits on a coast or has whale text', () => {
    for (const id of [PLACE['hudson-valley'], PLACE.london, PLACE.rome, PLACE['napa-and-sonoma'], PLACE.lisbon, PLACE.azores, PLACE.hokkaido, PLACE['malaysian-borneo'], 'cambodia', PLACE.cambodia]) expect(list.has(id), id).toBe(false);
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
    for (const id of [PLACE['yellowstone-national-park'], PLACE.bhutan, PLACE.nepal, PLACE.paris, PLACE.rwanda, PLACE['salar-de-uyuni'], PLACE['zion-and-bryce-canyon']]) expect(list.has(id), id).toBe(true);
  });
  it('never skips a place with a coast, a reef or a notable lake, spring or wreck draw', () => {
    for (const id of [PLACE['banff-and-jasper-national-parks'], PLACE.chicago, PLACE['texas-hill-country'], PLACE.pantanal, PLACE['zermatt-and-the-swiss-alps'], PLACE['antarctic-peninsula'], PLACE.tuscany, PLACE['petra-and-wadi-rum'], PLACE.vermont, PLACE['upper-peninsula'], PLACE['raja-ampat'], PLACE.london]) expect(list.has(id), id).toBe(false);
  });
});
