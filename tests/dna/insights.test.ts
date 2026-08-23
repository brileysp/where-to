import { describe, expect, it, vi } from 'vitest';
import { INSIGHT_TEMPLATES, generateInsightCheck } from '@/lib/dna/insights';
import { PREFERENCE_ATTRIBUTES, createEmptyPreferenceProfile } from '@/lib/dna/profile';
import { applySwipeBothSides, cards, createStatePair, legacy, mulberry32, scriptedSwipeSequence } from './helpers';

describe('INSIGHT_TEMPLATES — every template id + test() predicate matches legacy', () => {
  it('has the exact same set of template ids as the legacy engine', () => {
    const legacyIds = (legacy.INSIGHT_TEMPLATES as Array<{ id: string }>).map((t) => t.id).sort();
    const newIds = INSIGHT_TEMPLATES.map((t) => t.id).sort();
    expect(newIds).toEqual(legacyIds);
  });

  it('every template test() predicate agrees with legacy across real evolved profiles', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(90);
    const checkpoints = [10, 25, 40, 60, 90];
    const profilesToCheck: Array<Record<string, number>> = [];

    for (let i = 0; i < sequence.length; i++) {
      const { cardId, swipeType } = sequence[i];
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
      if (checkpoints.includes(i + 1)) profilesToCheck.push(newState.profile);
    }

    const legacyTemplateById = new Map((legacy.INSIGHT_TEMPLATES as Array<{ id: string; test: (p: unknown) => boolean }>).map((t) => [t.id, t]));

    for (const profile of profilesToCheck) {
      for (const template of INSIGHT_TEMPLATES) {
        const legacyTemplate = legacyTemplateById.get(template.id)!;
        expect(template.test(profile), `template ${template.id}`).toBe(legacyTemplate.test(profile));
      }
    }
  });

  it('every template test() predicate agrees with legacy across synthetic edge-case profiles', () => {
    // Every attribute pushed to a few representative values in turn —
    // cheap way to hit a lot of threshold boundaries across 42 templates
    // without needing 42 hand-crafted profiles.
    const edgeValues = [-5, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
    const legacyTemplateById = new Map((legacy.INSIGHT_TEMPLATES as Array<{ id: string; test: (p: unknown) => boolean }>).map((t) => [t.id, t]));

    for (const attr of PREFERENCE_ATTRIBUTES.slice(0, 30)) {
      for (const v of edgeValues) {
        const profile = createEmptyPreferenceProfile();
        profile[attr] = v;
        for (const template of INSIGHT_TEMPLATES) {
          const legacyTemplate = legacyTemplateById.get(template.id)!;
          expect(template.test(profile), `template ${template.id}, attr ${attr}=${v}`).toBe(legacyTemplate.test(profile));
        }
      }
    }
  });
});

describe('generateInsightCheck — matches legacy given an identical Math.random() sequence', () => {
  it('picks the same template id across a mocked-random 90-swipe session', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(90, 3);

    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
      legacyState.swipeCount = legacyState.swipes.length;
      newState.swipeCount = newState.swipes.length;

      const rng = mulberry32(42 + legacyState.swipeCount);
      const spy = vi.spyOn(Math, 'random').mockImplementation(rng);
      const legacyResult = legacy.generateInsightCheck(legacyState);
      spy.mockRestore();

      const rng2 = mulberry32(42 + newState.swipeCount);
      const spy2 = vi.spyOn(Math, 'random').mockImplementation(rng2);
      const newResult = generateInsightCheck(newState, cards);
      spy2.mockRestore();

      expect(newResult?.templateId).toBe(legacyResult?.templateId);
      if (legacyResult) {
        // Simulate the check having been shown, same as dna-ui.js would,
        // so the next iteration's gating (cooldown, already-shown set)
        // stays in sync between both sides.
        legacyState.lastInsightCheckSwipeCount = legacyState.swipeCount;
        newState.lastInsightCheckSwipeCount = newState.swipeCount;
      }
    }
  });
});
