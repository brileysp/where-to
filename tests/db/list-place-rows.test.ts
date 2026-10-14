import { describe, expect, it } from 'vitest';
import { DETAIL_TEXT_KEYS, LIST_COLUMN_KEYS } from '@/lib/db/queries/list-place-rows';

describe('the light list read for the public page', () => {
  it('never includes the text columns, which are fetched one place at a time', () => {
    for (const k of DETAIL_TEXT_KEYS) expect((LIST_COLUMN_KEYS as readonly string[]).includes(k)).toBe(false);
  });
  it('never includes the admin-only columns (authorship stamps, sources, N/A reasons, score status)', () => {
    for (const k of ['sliderOverviewMeta', 'sliderMonthlyWeatherMeta', 'sliderSources', 'naReasons', 'scoreStatus', 'authoredCurves']) expect((LIST_COLUMN_KEYS as readonly string[]).includes(k)).toBe(false);
  });
  it('keeps what the ranked list and scoring need', () => {
    for (const k of ['id', 'name', 'region', 'sliderCurves', 'baseScores', 'naSliders', 'isPublished', 'updatedAt', 'gated', 'costMin', 'costMax']) expect((LIST_COLUMN_KEYS as readonly string[]).includes(k)).toBe(true);
  });
});
