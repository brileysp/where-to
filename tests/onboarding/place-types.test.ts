import { describe, expect, it } from 'vitest';
import { ALL_PLACE_TYPES, PLACE_TYPES, allPlaceTypes, kindsOrAll, kindsToSave, placeTypeAllows, placeTypesText, togglePlaceType } from '@/lib/onboarding/place-types';
import { SETTING_TAG_SLUGS } from '@/lib/places/setting-tags';
import { tripAdjust } from '@/lib/onboarding/trip-adjust';
import { allBands } from '@/lib/onboarding/care';
import { fromTravelProfile, parseTravelProfile, toTravelProfile, type FlowChoices } from '@/lib/onboarding/profile';
import { effectiveTrip, newTrip, overridesFor, parseTrip } from '@/lib/onboarding/trips';

describe('what kind of place (owner, 22 Nov 2026)', () => {
  it('offers exactly the places\' own setting tags, so no new data is needed', () => {
    expect(ALL_PLACE_TYPES).toEqual([...SETTING_TAG_SLUGS]);
    expect(PLACE_TYPES.find((t) => t.key === 'city')?.label).toBe('City');
  });
  it('leaves a place out only when none of its tags is on; no tags is never left out', () => {
    expect(placeTypeAllows(ALL_PLACE_TYPES, ['city'])).toBe(true);
    expect(placeTypeAllows([], ['city'])).toBe(true); // an empty saved choice means all
    expect(placeTypeAllows(['island'], ['city'])).toBe(false);
    expect(placeTypeAllows(['island'], ['city', 'island'])).toBe(true);
    expect(placeTypeAllows(['island'], [])).toBe(true);
    expect(placeTypeAllows(['island'], undefined)).toBe(true);
  });
  it('turns kinds off and on, and the last one stays on', () => {
    const off = togglePlaceType(ALL_PLACE_TYPES, 'city');
    expect(off).not.toContain('city');
    expect(togglePlaceType(off, 'city')).toEqual(ALL_PLACE_TYPES);
    expect(togglePlaceType(['island'], 'island')).toEqual(['island']);
  });
  it('saves everything-on as an empty list and reads it back', () => {
    expect(kindsToSave(ALL_PLACE_TYPES)).toEqual([]);
    expect(kindsToSave(['island'])).toEqual(['island']);
    expect(kindsOrAll([])).toEqual(ALL_PLACE_TYPES);
    expect(kindsOrAll(undefined)).toEqual(ALL_PLACE_TYPES);
    expect(kindsOrAll(['island'])).toEqual(['island']);
    expect(allPlaceTypes(ALL_PLACE_TYPES)).toBe(true);
  });
  it('says it in words', () => {
    expect(placeTypesText(ALL_PLACE_TYPES)).toBe('Any');
    expect(placeTypesText(togglePlaceType(ALL_PLACE_TYPES, 'city'))).toBe('All except City');
    expect(placeTypesText(['island', 'city'])).toBe('City, Island');
  });
  it('trip adjustment leaves out the places with none of the kinds on, and says which', () => {
    const settingTags = { paris: ['city'], bali: ['island', 'beach-coast'], tuscany: ['town-countryside'], nowhere: [] as string[] };
    const adj = tripAdjust({ coords: {}, regions: {}, origin: null, length: null, continents: [], settingTags, placeTypes: ['island', 'beach-coast'] });
    expect([...adj.leftOut].sort()).toEqual(['paris', 'tuscany']);
    expect([...adj.leftOutKinds].sort()).toEqual(['paris', 'tuscany']);
    const none = tripAdjust({ coords: {}, regions: {}, origin: null, length: null, continents: [], settingTags, placeTypes: [] });
    expect(none.leftOut.size).toBe(0);
  });
});

describe('the choice is saved', () => {
  const base: FlowChoices = { levels: {}, subs: {}, bands: allBands(), care: {}, who: [], home: null, vibes: [], answers: [], month: 4, week: 0, maxHours: 0 };
  it('is kept with the dates, like the continents, and everything-on is stored as empty', () => {
    const kinds = ['island', 'beach-coast'];
    const kept = toTravelProfile({ ...base, placeTypes: kinds }, { when: true }, false);
    expect(kept.placeTypes).toEqual(kinds);
    expect(fromTravelProfile(kept, []).placeTypes).toEqual(kinds);
    expect(toTravelProfile({ ...base, placeTypes: kinds }, { when: false }, false).placeTypes).toEqual([]);
    expect(toTravelProfile({ ...base, placeTypes: ALL_PLACE_TYPES }, { when: true }, false).placeTypes).toEqual([]);
  });
  it('is read back safely, dropping anything unknown', () => {
    const kept = toTravelProfile({ ...base, placeTypes: ['island'] }, { when: true }, false);
    const back = parseTravelProfile(JSON.parse(JSON.stringify({ ...kept, placeTypes: ['island', 'nonsense'] })));
    expect(back?.placeTypes).toEqual(['island']);
    expect(parseTravelProfile(JSON.parse(JSON.stringify({ ...kept, placeTypes: 'x' })))?.placeTypes).toEqual([]);
  });
  it('a trip stores only what differs from the traveler\'s default, and reads it back', () => {
    const profile = { who: [], bands: allBands(), care: {}, peak: 2, placeTypes: [] as string[] };
    const work = { who: [], bands: allBands(), care: {}, peak: 2, placeTypes: ['city'] };
    const o = overridesFor(profile, work);
    expect(o.placeTypes).toEqual(['city']);
    expect(overridesFor(profile, { ...work, placeTypes: [] }).placeTypes).toBeUndefined();
    const trip = newTrip({ id: '0a1b2c3d-0000-4000-8000-000000000001', first: null, month: 4, overrides: o });
    const parsed = parseTrip(JSON.parse(JSON.stringify(trip)));
    expect(parsed && effectiveTrip(profile, parsed).placeTypes).toEqual(['city']);
    expect(effectiveTrip({ ...profile, placeTypes: ['island'] }, { overrides: {} }).placeTypes).toEqual(['island']);
  });
});
