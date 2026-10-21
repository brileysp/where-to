import { eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { interestChips, interestQuestionChips, interestQuestions } from '../schema';
import { SLIDERS } from '@/lib/scoring/constants';
import type { ChipRow, QuestionRow } from '@/lib/admin/interest-pages/types';

/** How many proposed question-to-chip links are waiting for the owner. Shown as a badge on the admin tab. */
export async function getSuggestedLinkCount(): Promise<number> {
  const rows = await db.select({ q: interestQuestionChips.questionKey }).from(interestQuestionChips).where(eq(interestQuestionChips.suggested, true));
  return rows.length;
}

export interface LinkReviewInterest {
  key: string;
  label: string;
  chips: ChipRow[];
  /** Only the questions that had a proposal when the page loaded. */
  questions: QuestionRow[];
}

/** Every interest with proposed links, with its chips and only the questions that have a proposal, for the Question links page. */
export async function getSuggestedLinkReview(): Promise<{ total: number; interests: LinkReviewInterest[] }> {
  const proposed = await db.select().from(interestQuestionChips).where(eq(interestQuestionChips.suggested, true));
  const keys = [...new Set(proposed.map((p) => p.interestKey))];
  if (keys.length === 0) return { total: 0, interests: [] };
  const [chipRows, questionRows, linkRows] = await Promise.all([
    db.select().from(interestChips).where(inArray(interestChips.interestKey, keys)),
    db.select().from(interestQuestions).where(inArray(interestQuestions.interestKey, keys)),
    db.select().from(interestQuestionChips).where(inArray(interestQuestionChips.interestKey, keys)),
  ]);
  const interests: LinkReviewInterest[] = keys.map((k) => {
    const withProposal = new Set(proposed.filter((p) => p.interestKey === k).map((p) => p.questionKey));
    return {
      key: k,
      label: SLIDERS.find((s) => s.key === k)?.label ?? k,
      chips: chipRows
        .filter((c) => c.interestKey === k)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c): ChipRow => ({ key: c.chipKey, label: c.label, order: c.sortOrder, status: c.status, drivers: c.drivers, needsColumn: c.needsColumn, approvedBy: c.approvedBy, approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null })),
      questions: questionRows
        .filter((r) => r.interestKey === k && withProposal.has(r.questionKey))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r): QuestionRow => ({
          key: r.questionKey, order: r.sortOrder, text: r.text, options: r.options, maxPicks: r.maxPicks, kind: r.kind, columns: r.columns, note: r.note, missMessage: r.missMessage,
          whenChips: linkRows.filter((l) => l.interestKey === k && l.questionKey === r.questionKey && !l.suggested).map((l) => l.chipKey).sort(),
          suggestedChips: linkRows.filter((l) => l.interestKey === k && l.questionKey === r.questionKey && l.suggested).map((l) => l.chipKey).sort(),
          approvedBy: r.approvedBy, approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
        })),
    };
  });
  interests.sort((a, b) => a.label.localeCompare(b.label));
  return { total: proposed.length, interests };
}
