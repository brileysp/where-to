import { eq } from 'drizzle-orm';
import { db } from '../client';
import { interestChips, interestQuestionChips, interestQuestions, placeInterestFacts } from '../schema';
import { factDefsFor } from '@/lib/admin/interest-pages/config';
import { buildPlaceFits, type PlaceMatchFits } from '@/lib/scoring/matchTable';
import type { MatchChipDef, MatchQuestionDef } from '@/lib/scoring/interestMatch';
import type { MatchSetups } from '@/lib/onboarding/live-types';

/**
 * What the new onboarding asks and how places answer it (docs/matching-model.md). Only what the owner approved is ever read: live chips and approved questions. Proposed links are ignored.
 */

export type { OnboardingQuestion, InterestMatchSetup, MatchSetups } from '@/lib/onboarding/live-types';

async function loadRows() {
  const [chipRows, questionRows, linkRows] = await Promise.all([
    db.select().from(interestChips).where(eq(interestChips.status, 'live')),
    db.select().from(interestQuestions),
    db.select().from(interestQuestionChips).where(eq(interestQuestionChips.suggested, false)),
  ]);
  return { chipRows, questionRows, linkRows };
}

/** Interests that have at least one approved question, each with its live chips and those questions. A question not yet tied to place data is still asked; it just changes nothing (`mapped` says which). */
export async function getMatchSetups(): Promise<MatchSetups> {
  const { chipRows, questionRows, linkRows } = await loadRows();
  const out: MatchSetups = {};
  const askable = questionRows.filter((q) => !!q.approvedAt && q.options.length > 0);
  for (const key of [...new Set(askable.map((q) => q.interestKey))]) {
    const chips = chipRows.filter((c) => c.interestKey === key).sort((a, b) => a.sortOrder - b.sortOrder);
    const questions = askable
      .filter((q) => q.interestKey === key)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((q) => ({
        key: q.questionKey,
        text: q.text,
        options: q.options,
        maxPicks: q.maxPicks,
        kind: q.kind,
        whenChips: linkRows.filter((l) => l.interestKey === key && l.questionKey === q.questionKey).map((l) => l.chipKey).sort(),
        order: q.sortOrder,
        mapped: !!q.fitRule,
        missMessage: q.missMessage,
      }));
    out[key] = {
      content: { chips: chips.map((c) => ({ key: c.chipKey, label: c.label, live: true })), questions: questions.map((q) => ({ key: q.key, kind: q.kind, whenChips: q.whenChips, missMessage: q.missMessage })) },
      questions: questions.map(({ missMessage: _m, ...rest }) => rest),
    };
  }
  return out;
}

export type MatchFits = Record<string, Record<string, PlaceMatchFits>>;

let cache: { at: number; value: Map<string, Record<string, PlaceMatchFits>> } | null = null;

/** For each asked interest, place id to how the place does for every chip and answer option. A place with no facts on file has no entry (a pass). Kept for a minute. */
export async function getMatchFits(interestKeys: string[]): Promise<MatchFits> {
  if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), value: new Map() };
  const wanted = [...new Set(interestKeys)];
  const missing = wanted.filter((k) => !cache!.value.has(k));
  if (missing.length) {
    const { chipRows, questionRows, linkRows } = await loadRows();
    const factRows = await db.select().from(placeInterestFacts);
    for (const key of missing) {
      const defs = factDefsFor(key);
      const chips: MatchChipDef[] = chipRows.filter((c) => c.interestKey === key).map((c) => ({ key: c.chipKey, label: c.label, live: true, drivers: c.drivers }));
      const questions: MatchQuestionDef[] = questionRows
        .filter((q) => q.interestKey === key)
        .map((q) => ({ key: q.questionKey, kind: q.kind, whenChips: linkRows.filter((l) => l.interestKey === key && l.questionKey === q.questionKey).map((l) => l.chipKey), fitRule: q.fitRule ?? null, missMessage: q.missMessage, approved: !!q.approvedAt }));
      const perPlace: Record<string, PlaceMatchFits> = {};
      for (const f of factRows) if (f.interestKey === key) perPlace[f.placeId] = buildPlaceFits(chips, questions, f.facts, defs);
      cache.value.set(key, perPlace);
    }
  }
  return Object.fromEntries(wanted.map((k) => [k, cache!.value.get(k) ?? {}]));
}
