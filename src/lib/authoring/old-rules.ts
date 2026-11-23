// 13 Nov 2026: the rules of the OLD authoring pipeline (src/lib/gemini/validate.ts) that the family pipeline never enforced, brought over as scanner hits.
// The old validator stays the single source of the checks; this adapter picks the ones that still make sense for family-pipeline texts and gives each a short id.
// Left out on purpose: the old length guides (the family pipeline has its own tiers), the "duplicate blurb text" warning (grouped blurbs are the design now),
// and the old shared-text score-spread reject (the owner's own limit, 1.5 points per blurb, is `wideGroup` in rules.ts).
import { validateContent } from '@/lib/gemini/validate';
import type { GenerationOutput } from '@/lib/gemini/schema';
import { usesMonthsNotSeasons, seasonWordsIn } from '@/lib/gemini/hemisphere';
import { INTEREST_ANCHORS } from '@/lib/scoring/anchors';

export interface OldRuleHit { id: string; blocks: boolean; message: string }

const MAP: Array<{ id: string; blocks: boolean; test: RegExp }> = [
  { id: 'transitionShared', blocks: true, test: /share text that describes a transition/ },
  { id: 'residentVerb', blocks: true, test: /used for what looks like a permanent resident/ },
  { id: 'oldName', blocks: true, test: /The old name ".*" appears in the text/ },
  { id: 'severeScore', blocks: false, test: /describes severe conditions but scores/ },
  { id: 'negativeFraming', blocks: false, test: /Negative framing/ },
  { id: 'selfRating', blocks: false, test: /Self-rating word/ },
  { id: 'acronym', blocks: false, test: /Acronym\(s\) not expanded|Acronym.*not expanded/ },
];

export const OLD_RULE_LABELS: Record<string, string> = {
  transitionShared: 'a shared blurb describes a change (a transition) but covers months that are not the same',
  residentVerb: 'a verb meant for visitors used for something that lives there all year',
  oldName: 'a place\'s old name still appears in the text',
  severeScore: 'text says severe conditions but the month scores high',
  negativeFraming: 'states what the place lacks',
  selfRating: 'self-rating word ("premier", "world-class")',
  acronym: 'acronym not spelled out on first use',
  monthsNotSeasons: 'seasons named for a southern-hemisphere or equatorial place (use months)',
  tenOffAnchor: 'a 10 for a place that is not on this interest\'s list of world-best places',
};

/** Old-pipeline rule hits for one saved or proposed cell. `scores` are the twelve month scores, used for the 10-needs-an-anchor rule. */
export function oldRuleHits(g: { overview: string; blurbs: Array<{ months: number[]; text: string }>; monthly_scores: number[] }, interestKey: string, placeId: string, countryCode?: string | null): OldRuleHit[] {
  const wx: string[] = new Array(12).fill('');
  for (const b of g.blurbs) for (const m of b.months) if (m >= 1 && m <= 12) wx[m - 1] = b.text;
  const out = { overview: g.overview, monthly: wx.map((text, i) => ({ month: i + 1, text, score: g.monthly_scores[i] })), flags: [], confidence: 'high' } as unknown as GenerationOutput;
  let issues: Array<{ message: string }> = [];
  try { issues = validateContent(out, interestKey, placeId, { monthsNotSeasons: usesMonthsNotSeasons(countryCode) }); } catch { /* an unreadable cell is caught elsewhere */ }
  const hits: OldRuleHit[] = [];
  for (const m of MAP) { const is = issues.find((x) => m.test.test(x.message)); if (is) hits.push({ id: m.id, blocks: m.blocks, message: is.message }); }
  // The old validator only runs this check for hiking, so it is done here for every interest.
  if (usesMonthsNotSeasons(countryCode)) { const found = [...new Set([g.overview, ...g.blurbs.map((b) => b.text)].flatMap((t) => seasonWordsIn(t)))]; if (found.length) hits.push({ id: 'monthsNotSeasons', blocks: false, message: `Southern-hemisphere or equatorial place: name months, not seasons (found: ${found.join(', ')}).` }); }
  const anchor = INTEREST_ANCHORS[interestKey];
  if (anchor && Math.max(...g.monthly_scores) >= 9.95 && !anchor.ten.includes(placeId)) hits.push({ id: 'tenOffAnchor', blocks: true, message: `${placeId} scores 10 for ${interestKey} but is not on the list of places allowed a 10.` });
  return hits;
}
