import { eq, desc, inArray, sql } from 'drizzle-orm';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from '../client';
import { authoringPasses, contentGenerationBatches, contentGenerations, interestReviews, interestTodos, interestPlaceIdeas, interestReferenceSites, interestRuleSections, placeInterestFacts, interestChips, placeChipOverrides, interestQuestions, interestQuestionChips } from '../schema';
import { getAllScoredPlaces } from './places';
import { getPrimaryPlaceRows } from './primary-place-rows';
import { SLIDERS, VISIBLE_SLIDERS, INACTIVE_NOTES } from '@/lib/scoring/constants';
import { INTEREST_ANCHORS } from '@/lib/scoring/anchors';
import { loadAnchorOverrides } from '@/lib/scoring/anchorOverrides';
import { isSliderNA } from '@/lib/scoring/destinations';
import { factDefsFor, RULES_TAB_KEYS } from '@/lib/admin/interest-pages/config';
import { describeQuestionRule } from '@/lib/onboarding/question-fit';
import { PLACE_TYPE_BY_ID } from '@/lib/admin/interest-pages/place-types';
import { computeCompleteness, type Completeness, type PlaceInput } from '@/lib/admin/interest-pages/completeness';
import type { AuthoringBatchRow, AuthoringPassRow, ChipOverrideRow, ChipRow, IdeaRow, InterestPageData, InterestPlaceRow, NaReasonInfo, PlaceStatus, QuestionRow, ReferenceSiteRow, ReviewRow, TodoRow } from '@/lib/admin/interest-pages/types';

/**
 * Authoring passes for one interest, newest first, each with its batches: when it finished (or "in progress"), places, tokens and cost.
 * Batches with no results (empty or crashed runs) are left out. See docs/authoring-passes-spec.md.
 */
export async function getAuthoringPasses(interestKey: string): Promise<AuthoringPassRow[]> {
  const [passes, batches, counts] = await Promise.all([
    db.select().from(authoringPasses).where(eq(authoringPasses.interestKey, interestKey)),
    db.select().from(contentGenerationBatches).where(eq(contentGenerationBatches.interestKey, interestKey)),
    db
      .select({
        batchId: contentGenerations.batchId,
        n: sql<number>`count(*)::int`,
        places: sql<number>`count(distinct ${contentGenerations.placeId})::int`,
        valid: sql<number>`(count(*) filter (where ${contentGenerations.validationStatus} = 'valid'))::int`,
        invalid: sql<number>`(count(*) filter (where ${contentGenerations.validationStatus} = 'invalid'))::int`,
        notApplicable: sql<number>`(count(*) filter (where ${contentGenerations.parsedOutput}->>'overview' like 'NOT_APPLICABLE%'))::int`,
        applied: sql<number>`(count(*) filter (where ${contentGenerations.appliedAt} is not null))::int`,
        lastAt: sql<string>`max(${contentGenerations.createdAt})`,
      })
      .from(contentGenerations)
      .where(eq(contentGenerations.interestKey, interestKey))
      .groupBy(contentGenerations.batchId),
  ]);
  const countsByBatch = new Map(counts.map((c) => [c.batchId, c]));
  const placesByPass = await db
    .select({ passId: contentGenerationBatches.passId, places: sql<number>`count(distinct ${contentGenerations.placeId})::int` })
    .from(contentGenerations)
    .innerJoin(contentGenerationBatches, eq(contentGenerations.batchId, contentGenerationBatches.id))
    .where(eq(contentGenerationBatches.interestKey, interestKey))
    .groupBy(contentGenerationBatches.passId);
  const placesMap = new Map(placesByPass.map((r) => [r.passId, r.places]));

  return passes
    .map((p): AuthoringPassRow => {
      const mine = batches
        .filter((b) => b.passId === p.id && (countsByBatch.get(b.id)?.n ?? 0) > 0)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      const rows: AuthoringBatchRow[] = mine.map((b) => {
        const c = countsByBatch.get(b.id)!;
        return {
          id: b.id,
          startedAt: b.startedAt.toISOString(),
          finishedAt: b.finishedAt?.toISOString() ?? null,
          places: c.places,
          tokensIn: b.tokensIn,
          tokensOut: b.tokensOut,
          costUsd: b.totalCostUsd,
          model: b.model,
          promptVersion: b.promptVersion,
          thinkingLevel: b.thinkingLevel,
          valid: c.valid,
          invalid: c.invalid,
          notApplicable: c.notApplicable,
          applied: c.applied,
        };
      });
      const last = rows.reduce((m, r) => Math.max(m, Date.parse(r.finishedAt ?? r.startedAt)), 0);
      return {
        id: p.id,
        label: p.label,
        kind: p.kind,
        promptVersion: p.promptVersion,
        notes: p.notes,
        finishedAt: p.finishedAt?.toISOString() ?? null,
        startedAt: rows.length ? rows[rows.length - 1].startedAt : p.createdAt.toISOString(),
        lastActivityAt: last ? new Date(last).toISOString() : p.createdAt.toISOString(),
        places: placesMap.get(p.id) ?? 0,
        tokensIn: rows.reduce((a, r) => a + r.tokensIn, 0),
        tokensOut: rows.reduce((a, r) => a + r.tokensOut, 0),
        costUsd: rows.reduce((a, r) => a + r.costUsd, 0),
        batches: rows,
      };
    })
    .filter((p) => p.batches.length > 0)
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

/** Date each interest's most recent Gemini pass finished (or null while a pass is still in progress), for the Interests list. */
export async function getLastPassFinishedByInterest(): Promise<Record<string, { finishedAt: string | null; label: string } | undefined>> {
  // Hand-edit passes (kind 'targeted': Claude's source-check edits, no Gemini call) do not count as a Gemini pass.
  const rows = (await db.select().from(authoringPasses)).filter((r) => r.kind !== 'targeted');
  const out: Record<string, { finishedAt: string | null; label: string } | undefined> = {};
  const byInterest = new Map<string, typeof rows>();
  for (const r of rows) byInterest.set(r.interestKey, [...(byInterest.get(r.interestKey) ?? []), r]);
  for (const [k, list] of byInterest) {
    const open = list.filter((r) => !r.finishedAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const done = list.filter((r) => r.finishedAt).sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime())[0];
    out[k] = open ? { finishedAt: null, label: open.label } : done ? { finishedAt: done.finishedAt!.toISOString(), label: done.label } : undefined;
  }
  return out;
}

/** Newest prompts/<interest>/vN.md, if the prompts folder is deployed alongside the app. */
function latestDirective(interestKey: string): string | null {
  try {
    const dir = join(process.cwd(), 'prompts', interestKey);
    if (!existsSync(dir)) return null;
    const versions = readdirSync(dir)
      .map((f) => /^v(\d+)\.md$/.exec(f))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => Number(m[1]));
    if (versions.length === 0) return null;
    return `prompts/${interestKey}/v${Math.max(...versions)}.md`;
  } catch {
    return null;
  }
}

/** Written-overview and N/A counts per interest, for the Interests tab. */
export async function getInterestCoverage(): Promise<Record<string, { written: number; na: number; total: number }>> {
  const rows = await getPrimaryPlaceRows();
  const out: Record<string, { written: number; na: number; total: number }> = {};
  for (const s of SLIDERS) {
    let written = 0;
    let na = 0;
    for (const r of rows) {
      if ((r.sliderOverview?.[s.key] ?? '').length > 0) written++;
      if (r.naSliders?.includes(s.key)) na++;
    }
    out[s.key] = { written, na, total: rows.length };
  }
  return out;
}


/**
 * Completeness score for the given interests (all visible ones when no keys are passed). Reads the cached place
 * rows plus narrow queries on generations, facts, reviews and ideas.
 */
export async function getInterestCompleteness(keys?: string[], scoredById?: Map<string, { monthly: Record<string, number[]> }>): Promise<Record<string, Completeness>> {
  await loadAnchorOverrides();
  const sliderKeys = keys ?? VISIBLE_SLIDERS.map((s) => s.key);
  if (sliderKeys.length === 0) return {};
  const rows = await getPrimaryPlaceRows();
  const scored = scoredById ?? new Map((await getAllScoredPlaces({ includeUnpublished: true })).map((d) => [d.id, d]));

  const [gens, facts, reviews, ideas] = await Promise.all([
    db
      .select({ placeId: contentGenerations.placeId, interestKey: contentGenerations.interestKey, status: contentGenerations.validationStatus, createdAt: contentGenerations.createdAt, appliedAt: contentGenerations.appliedAt })
      .from(contentGenerations)
      .where(inArray(contentGenerations.interestKey, sliderKeys)),
    db.select({ placeId: placeInterestFacts.placeId, interestKey: placeInterestFacts.interestKey, facts: placeInterestFacts.facts }).from(placeInterestFacts).where(inArray(placeInterestFacts.interestKey, sliderKeys)),
    db.select({ interestKey: interestReviews.interestKey, placeId: interestReviews.placeId, reviewedOn: interestReviews.reviewedOn }).from(interestReviews).where(inArray(interestReviews.interestKey, sliderKeys)),
    db.select({ interestKey: interestPlaceIdeas.interestKey }).from(interestPlaceIdeas).where(inArray(interestPlaceIdeas.interestKey, sliderKeys)),
  ]);

  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const out: Record<string, Completeness> = {};
  for (const key of sliderKeys) {
    const keyGens = gens.filter((g) => g.interestKey === key);
    const lastApplied = new Map<string, number>();
    for (const g of keyGens) if (g.appliedAt) lastApplied.set(g.placeId, Math.max(lastApplied.get(g.placeId) ?? 0, g.appliedAt.getTime()));
    const staged = new Set<string>();
    for (const g of keyGens) if (g.status === 'valid' && !g.appliedAt && g.createdAt.getTime() > (lastApplied.get(g.placeId) ?? 0)) staged.add(g.placeId);
    const factsByPlace = new Map(facts.filter((f) => f.interestKey === key).map((f) => [f.placeId, f.facts]));
    const recent = reviews.filter((r) => r.interestKey === key && r.reviewedOn >= cutoff);
    const reviewedPlaces = new Set(recent.filter((r) => r.placeId).map((r) => r.placeId as string));
    const anchor = INTEREST_ANCHORS[key];

    const places: PlaceInput[] = rows.map((r) => ({
      id: r.id,
      na: !!r.naSliders?.includes(key),
      overview: r.sliderOverview?.[key] ?? '',
      blurbs: r.sliderMonthlyWeather?.[key] ?? null,
      authored: !!r.authoredCurves?.includes(key),
      monthly: scored.get(r.id)?.monthly?.[key] ?? [],
      events: r.sliderEvents?.[key] ?? [],
      staged: staged.has(r.id),
      facts: factsByPlace.get(r.id) ?? {},
      placeReviewed: reviewedPlaces.has(r.id),
    }));
    out[key] = computeCompleteness({
      places,
      factDefs: factDefsFor(key),
      hasDefinition: !!anchor?.definition,
      hasTen: (anchor?.ten.length ?? 0) > 0,
      hasDirective: latestDirective(key) !== null,
      hasRulesTab: RULES_TAB_KEYS.has(key),
      ideasCount: ideas.filter((i) => i.interestKey === key).length,
      wideReviewed: recent.some((r) => !r.placeId),
    });
  }
  return out;
}

let allCache: { at: number; value: Record<string, Completeness> } | null = null;
/** Score for every interest, kept for a minute so the Interests tab does not re-read the tables on each refresh. */
export async function getAllInterestCompleteness(): Promise<Record<string, Completeness>> {
  if (allCache && Date.now() - allCache.at < 60_000) return allCache.value;
  const value = await getInterestCompleteness();
  allCache = { at: Date.now(), value };
  return value;
}

export async function getInterestPageData(interestKey: string): Promise<InterestPageData | null> {
  await loadAnchorOverrides();
  const slider = SLIDERS.find((s) => s.key === interestKey);
  if (!slider) return null;

  const [scored, primaryRows, genRows, factRows, reviewRows, todoRows, ideaRows, siteRows, passRows, ruleRows, chipRows, overrideRows, questionRows, questionChipRows] = await Promise.all([
    getAllScoredPlaces({ includeUnpublished: true }),
    getPrimaryPlaceRows(),
    db
      .select({ id: contentGenerations.id, placeId: contentGenerations.placeId, status: contentGenerations.validationStatus, createdAt: contentGenerations.createdAt, appliedAt: contentGenerations.appliedAt })
      .from(contentGenerations)
      .where(eq(contentGenerations.interestKey, interestKey)),
    db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, interestKey)),
    db.select().from(interestReviews).where(eq(interestReviews.interestKey, interestKey)).orderBy(desc(interestReviews.reviewedOn), desc(interestReviews.createdAt)),
    db.select().from(interestTodos).where(eq(interestTodos.interestKey, interestKey)).orderBy(interestTodos.createdAt),
    db.select().from(interestPlaceIdeas).where(eq(interestPlaceIdeas.interestKey, interestKey)).orderBy(interestPlaceIdeas.sortOrder, interestPlaceIdeas.name),
    db.select().from(interestReferenceSites).where(eq(interestReferenceSites.interestKey, interestKey)).orderBy(desc(interestReferenceSites.usefulness), interestReferenceSites.label),
    getAuthoringPasses(interestKey),
    db.select().from(interestRuleSections).where(eq(interestRuleSections.interestKey, interestKey)),
    db.select().from(interestChips).where(eq(interestChips.interestKey, interestKey)).orderBy(interestChips.sortOrder),
    db.select().from(placeChipOverrides).where(eq(placeChipOverrides.interestKey, interestKey)),
    db.select().from(interestQuestions).where(eq(interestQuestions.interestKey, interestKey)).orderBy(interestQuestions.sortOrder),
    db.select().from(interestQuestionChips).where(eq(interestQuestionChips.interestKey, interestKey)),
  ]);
  const completenessMap = await getInterestCompleteness([interestKey], new Map(scored.map((d) => [d.id, d])));

  // Staged = a valid generation that was never applied and is newer than the last applied one.
  const lastApplied = new Map<string, number>();
  for (const g of genRows) if (g.appliedAt) lastApplied.set(g.placeId, Math.max(lastApplied.get(g.placeId) ?? 0, g.appliedAt.getTime()));
  const staged = new Set<string>();
  const stagedId = new Map<string, { id: string; at: number }>();
  for (const g of genRows) {
    if (g.status === 'valid' && !g.appliedAt && g.createdAt.getTime() > (lastApplied.get(g.placeId) ?? 0)) {
      staged.add(g.placeId);
      const cur = stagedId.get(g.placeId);
      if (!cur || g.createdAt.getTime() > cur.at) stagedId.set(g.placeId, { id: g.id, at: g.createdAt.getTime() });
    }
  }
  const factsByPlace = new Map(factRows.map((f) => [f.placeId, f.facts]));
  const naReasonByPlace = new Map<string, NaReasonInfo>();
  for (const r of primaryRows) {
    const n = (r.naReasons as Record<string, NaReasonInfo> | undefined)?.[interestKey];
    if (n) naReasonByPlace.set(r.id, n);
  }

  const places: InterestPlaceRow[] = scored
    .map((d) => {
      const written = (d.sliderOverview?.[interestKey] ?? '').length > 0;
      const status: PlaceStatus = isSliderNA(d, interestKey) ? 'na' : written ? 'live' : staged.has(d.id) ? 'staged' : 'none';
      return {
        id: d.id,
        name: d.name,
        region: d.region,
        monthly: (d.monthly?.[interestKey] ?? []).map((v) => Math.round(v * 10) / 10),
        status,
        naReason: status === 'na' ? naReasonByPlace.get(d.id) ?? null : null,
        placeType: PLACE_TYPE_BY_ID[d.id] ?? 'Tropical islands',
        facts: factsByPlace.get(d.id) ?? {},
        overview: d.sliderOverview?.[interestKey] ?? '',
        monthlyText: d.sliderMonthlyWeather?.[interestKey] ?? [],
        stagedGenerationId: stagedId.get(d.id)?.id ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const nameById = new Map(scored.map((d) => [d.id, d.name]));
  const anchor = INTEREST_ANCHORS[interestKey];

  const toReview = (r: typeof interestReviews.$inferSelect): ReviewRow => ({
    id: r.id,
    placeId: r.placeId,
    reviewerName: r.reviewerName,
    reviewerRole: r.reviewerRole,
    reviewedOn: r.reviewedOn,
    notes: r.notes,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  });
  const toSite = (r: typeof interestReferenceSites.$inferSelect): ReferenceSiteRow => ({
    id: r.id,
    siteUrl: r.siteUrl,
    label: r.label,
    goodFor: r.goodFor,
    usefulness: r.usefulness,
    aiAccess: r.aiAccess,
    lastUsedOn: r.lastUsedOn,
    placesChecked: r.placesChecked,
    createdAt: r.createdAt.toISOString(),
  });
  const toTodo = (r: typeof interestTodos.$inferSelect): TodoRow => ({
    id: r.id,
    title: r.title,
    detail: r.detail,
    status: r.status,
    source: r.source,
    placeId: r.placeId,
    closeOnApply: r.closeOnApply,
    priority: r.priority,
    dueOn: r.dueOn,
    repeatEvery: r.repeatEvery,
    createdAt: r.createdAt.toISOString(),
    doneAt: r.doneAt ? r.doneAt.toISOString() : null,
  });
  const toIdea = (r: typeof interestPlaceIdeas.$inferSelect): IdeaRow => ({
    id: r.id,
    name: r.name,
    region: r.region,
    why: r.why,
    nearestExisting: r.nearestExisting,
    placeType: r.placeType,
    stage: r.stage,
    grain: r.grain,
    grainNote: r.grainNote,
    sortOrder: r.sortOrder,
    promotedPlaceId: r.promotedPlaceId,
    createdAt: r.createdAt.toISOString(),
  });

  return {
    key: slider.key,
    label: slider.label,
    icon: slider.icon,
    group: slider.group,
    formula: slider.formula,
    audienceTier: slider.audienceTier ?? null,
    anchor: anchor ? { definition: anchor.definition, ten: anchor.ten.map((id) => ({ id, name: nameById.get(id) ?? id })) } : null,
    directive: latestDirective(interestKey),
    places,
    placeOptions: places.map((p) => ({ id: p.id, name: p.name })),
    factDefs: factDefsFor(interestKey),
    reviews: reviewRows.map(toReview),
    referenceSites: siteRows.map(toSite),
    todos: todoRows.map(toTodo),
    ideas: ideaRows.map(toIdea),
    completeness: completenessMap[interestKey],
    passes: passRows,
    questions: questionRows.map((r): QuestionRow => ({ key: r.questionKey, order: r.sortOrder, text: r.text, options: r.options, maxPicks: r.maxPicks, kind: r.kind, columns: r.columns, note: r.note, missMessage: r.missMessage, fitSummary: describeQuestionRule(r.fitRule ?? null, r.options, factDefsFor(r.interestKey)), whenChips: questionChipRows.filter((x) => x.questionKey === r.questionKey && !x.suggested).map((x) => x.chipKey).sort(), suggestedChips: questionChipRows.filter((x) => x.questionKey === r.questionKey && x.suggested).map((x) => x.chipKey).sort(), approvedBy: r.approvedBy, approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null })),
    chips: chipRows.map((c): ChipRow => ({ key: c.chipKey, label: c.label, order: c.sortOrder, status: c.status, drivers: c.drivers, needsColumn: c.needsColumn, approvedBy: c.approvedBy, approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null })),
    chipOverrides: overrideRows.map((o): ChipOverrideRow => ({ chipKey: o.chipKey, placeId: o.placeId, fit: o.fit, reason: o.reason, setBy: o.setBy, setAt: o.setAt.toISOString() })),
    ruleOverrides: Object.fromEntries(ruleRows.map((r) => [r.sectionKey, r.items])),
    // Inactive interests stay out of the picker, except the one being looked at.
    interestOptions: SLIDERS.filter((s) => !s.hidden || s.key === interestKey).map((s) => ({ key: s.key, label: s.hidden ? `${s.label} (inactive)` : s.label, icon: s.icon, group: s.group })),
    inactive: slider.hidden ? { note: INACTIVE_NOTES[interestKey] ?? '' } : null,
  };
}
