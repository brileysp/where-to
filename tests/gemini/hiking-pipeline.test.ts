import { describe, expect, it } from 'vitest';
import { generationOutputSchemaFlatV2Hike, normalizeFlatOutput } from '../../src/lib/gemini/schema';
import { validateContent } from '../../src/lib/gemini/validate';
import type { GenerationOutput } from '../../src/lib/gemini/schema';

const flat = (over: Record<string, unknown> = {}) => {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const scores = [0, 0, 0.4, 2.2, 4.1, 6.3, 8.4, 8.9, 7.1, 4.6, 1.2, 0];
  return {
    score_max: 8.9, score_min: 0,
    ...Object.fromEntries(months.map((m, i) => [`score_${m}`, scores[i]])),
    day_hike_rating: 8.5, trek_rating: 9,
    blurb_overall: 'The high trails above the village are strenuous day hikes with glacier views, best from July to September.',
    ...Object.fromEntries(months.map((m, i) => [`blurb_${m}`, `Month ${i + 1}: the trails above 6,500 ft hold snow, so only the valley paths are walkable.`])),
    ...over,
  };
};

describe('hiking pipeline', () => {
  it('parses the two-rating shape and carries both ratings as extras', () => {
    const parsed = generationOutputSchemaFlatV2Hike.parse(flat());
    const { output, selfCheckIssues } = normalizeFlatOutput(parsed);
    expect(selfCheckIssues).toEqual([]);
    expect(output.extras).toEqual({ day_hike_rating: 8.5, trek_rating: 9 });
    expect(output.monthly).toHaveLength(12);
  });
  it('rejects an answer with a rating missing', () => {
    expect(generationOutputSchemaFlatV2Hike.safeParse(flat({ trek_rating: undefined })).success).toBe(false);
  });
  const out = (over: Partial<GenerationOutput> = {}): GenerationOutput => ({ ...normalizeFlatOutput(generationOutputSchemaFlatV2Hike.parse(flat())).output, ...over });
  it('warns when the better rating is not within 0.5 of the peak', () => {
    const o = out();
    o.extras = { day_hike_rating: 5, trek_rating: 6 };
    expect(validateContent(o, 'hiking', 'dolomites').some((i) => /better of the two ratings/.test(i.message))).toBe(true);
  });
  it('rejects a rating outside 0 to 10', () => {
    const o = out();
    o.extras = { day_hike_rating: 11, trek_rating: 9 };
    expect(validateContent(o, 'hiking', 'dolomites').some((i) => i.severity === 'reject' && /between 0 and 10/.test(i.message))).toBe(true);
  });
  it('only warns about a 10 outside the expected eight', () => {
    const o = out();
    o.monthly[7] = { ...o.monthly[7], score: 10 };
    const tens = validateContent(o, 'hiking', 'madeira').filter((i) => /not in that interest's anchor list/.test(i.message));
    expect(tens).toHaveLength(1);
    expect(tens[0].severity).toBe('warning');
  });
  it('allows "world-class" once in the overview, warns on a second use or one in a month', () => {
    const one = out({ overview: 'A world-class trek over glacier passes, strenuous and best from July to September, starting from the village of Chamonix.' });
    expect(validateContent(one, 'hiking', 'chamonix').some((i) => /World-class|appears/.test(i.message))).toBe(false);
    const two = out({ overview: 'A world-class trek, a legendary glacier crossing, strenuous and best from July to September, from the village of Chamonix.' });
    expect(validateContent(two, 'hiking', 'chamonix').some((i) => /at most once/.test(i.message))).toBe(true);
    const m = out();
    m.monthly[6] = { ...m.monthly[6], text: 'A world-class stretch of high trail is open and strenuous above 8,000 ft.' };
    expect(validateContent(m, 'hiking', 'chamonix').some((i) => /never in a month/.test(i.message))).toBe(true);
  });

  it('warns on the v3 overview and month rules (14 Oct 2026)', () => {
    const msgs = (o: GenerationOutput) => validateContent(o, 'hiking', 'sedona').map((i) => i.message).join(' | ');
    expect(msgs(out({ overview: 'The walking suits day hikers best, with easy 2-mile loops and a steep strenuous scramble, best in spring and autumn near town.' }))).toMatch(/suits or that it is day-hike only/);
    expect(msgs(out({ overview: 'Easy 2-mile loops near the town and a strenuous scramble up a steep rock, best in spring and autumn when it is mild.' }))).toMatch(/distance but no multi-day route/);
    expect(msgs(out({ overview: 'The 75-mile Alta Via takes 10 to 13 days, a strenuous trek through the high limestone towers, with day hikes beside it too.' }))).not.toMatch(/distance but no multi-day route/);
    const m = out(); m.monthly[0] = { ...m.monthly[0], text: 'Pushing most walkers indoors to the treadmill when the paths ice over in the cold.' };
    expect(msgs(m)).toMatch(/indoors, treadmills or gyms/);
    m.monthly[1] = { ...m.monthly[1], text: 'There is no trail network and the paths ice over.' };
    expect(msgs(m)).toMatch(/there is no/);
  });
});
