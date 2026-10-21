import { db } from '@/lib/db/client';
import { appSettings, interestChips, interestQuestionChips, interestQuestions, interestTodos, placeInterestFacts, places } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { TruthContext } from './context';

/** Loads everything the checks need from the database (read only). Used by scripts/check-truths.ts. */
export async function loadTruthContext(): Promise<TruthContext> {
  const [chips, questions, links, facts, placeRows, todos, setting] = await Promise.all([
    db.select().from(interestChips),
    db.select().from(interestQuestions),
    db.select().from(interestQuestionChips),
    db.select().from(placeInterestFacts),
    db.select({ id: places.id, name: places.name, region: places.region, emoji: places.emoji, baseScores: places.baseScores, curves: places.sliderCurves, naSliders: places.naSliders, naReasons: places.naReasons, overview: places.sliderOverview, monthly: places.sliderMonthlyWeather }).from(places),
    db.select({ id: interestTodos.id, status: interestTodos.status, doneAt: interestTodos.doneAt }).from(interestTodos),
    db.select().from(appSettings).where(eq(appSettings.key, 'matching')),
  ]);
  return {
    chips: chips.map((c) => ({ interestKey: c.interestKey, chipKey: c.chipKey, label: c.label, status: c.status, drivers: c.drivers, needsColumn: c.needsColumn, approvedBy: c.approvedBy, approvedAt: c.approvedAt })),
    questions: questions.map((q) => ({ interestKey: q.interestKey, questionKey: q.questionKey, text: q.text, options: q.options, maxPicks: q.maxPicks, missMessage: q.missMessage, fitRule: (q.fitRule as never) ?? null, approvedBy: q.approvedBy, approvedAt: q.approvedAt })),
    links: links.map((l) => ({ interestKey: l.interestKey, questionKey: l.questionKey, chipKey: l.chipKey, suggested: l.suggested })),
    facts: facts.map((f) => ({ placeId: f.placeId, interestKey: f.interestKey, facts: f.facts })),
    places: placeRows.map((p) => ({ id: p.id, name: p.name, region: p.region, emoji: p.emoji, baseScores: p.baseScores, curves: p.curves, naSliders: p.naSliders, naReasons: p.naReasons, overview: p.overview ?? {}, monthly: (p.monthly as never) ?? {} })),
    todos,
    matchOverride: setting[0]?.value ?? null,
  };
}
