import { factDefsFor } from '@/lib/admin/interest-pages/config';
import { canDrive, driverProblem, MAX_LIVE_CHIPS } from '@/lib/admin/interest-pages/chips';
import { interestMatchFor, type MatchChipDef, type MatchQuestionDef } from '@/lib/scoring/interestMatch';
import { DEFAULT_MATCH_SETTINGS, mergeMatchSettings, matchSettingsProblem } from '@/lib/scoring/matchSettings';
import { matchInterest, type AnswerCheck, type TickedChip } from '@/lib/scoring/personalMatch';
import { QUESTION_FIT_RULES } from '@/lib/onboarding/question-fit-rules';
import { lowestTempF } from '@/lib/onboarding/question-fit';
import { questionsToAsk, questionsWaitingOnDrafts } from '@/lib/onboarding/question-rules';
import { pickerInterests } from '@/lib/onboarding/interests';
import { birdCaseProblems, SPECIES_CASE_INTERESTS } from '@/lib/text/species-case';
import { retiredBirdNames } from '@/lib/text/retired-bird-names';
import { emphasisIsBalanced } from '@/lib/text/emphasis';
import type { TruthContext } from './context';
import { REMOVED_ANSWERS, REMOVED_INTERESTS, UNSELECTED_CHIPS } from './decisions';

/**
 * The known truths: plain-language statements about what must always be true of Where To?, each one a check that can fail. They are the owner's
 * decisions turned into tests (docs/north-star.md, bet 2). A model or a script may change data or code only if every truth still holds.
 *
 * A truth marked `pending` is a real truth that does not hold yet because we know about the gap and are working on it. It shows as PENDING,
 * never silently passes, and the reason says what closes it. When the gap closes, remove the `pending` line.
 */
export type TruthArea = 'Matching' | 'Chips and questions' | 'Places and scores' | 'Facts' | 'Text' | 'Admin';

export interface TruthResult {
  ok: boolean;
  /** What failed, in plain words, with a few examples. */
  detail?: string;
}

export interface Truth {
  id: string;
  area: TruthArea;
  /** The statement, as the owner would say it. */
  says: string;
  check: (ctx: TruthContext) => TruthResult;
  pending?: string;
}

/**
 * Places where Beaches is on although neither surfing nor diving applies: a real coast with no waves or diving (Copenhagen, Acadia), and cities with a real
 * urban swimming scene (Paris Plages, Berlin's lakes, Vienna's Alte Donau). Owner rule, 22 Oct 2026.
 */
const COASTAL_WITHOUT_SURF = ['copenhagen', 'acadia', 'paris', 'berlin', 'vienna'];
/** Swimming that is not about the ocean at all (river and swimming holes), so it says nothing about being near a coast. */
const INLAND_SWIMMING = ['guilin-yangshuo', 'hudson-valley'];
/** A not-applicable reason that says the place is too far away. Murky water or no diving is a fine reason; being too far is not (owner rule, 24 Oct 2026). */
const TOO_FAR = /too far|far from|requires? travel|other regions/i;
const pass: TruthResult = { ok: true };
const fail = (detail: string): TruthResult => ({ ok: false, detail });
const some = (xs: string[], n = 5) => (xs.length > n ? `${xs.slice(0, n).join('; ')} (and ${xs.length - n} more)` : xs.join('; '));
const noneOf = (bad: string[], what: string): TruthResult => (bad.length ? fail(`${bad.length} ${what}: ${some(bad)}`) : pass);
const approved = (x: { approvedAt: Date | string | null }) => !!x.approvedAt;
const KEY = (a: string, b: string) => `${a}/${b}`;
/** JSON with sorted keys, so the same rule saved in a different key order compares equal. */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : x));

// ---- small synthetic worlds for the matching truths ----
const chip = (label: string, rating: number | null): TickedChip => ({ label, rating });
const limit = (fit: number | null, message = ''): AnswerCheck => ({ kind: 'limit', fit, message });
const lean = (fit: number | null, message = ''): AnswerCheck => ({ kind: 'lean', fit, message });
const defs = [{ key: 'level', label: 'Level', type: 'rating' as const, group: 'x' }, { key: 'kind', label: 'Kind', type: 'choice' as const, group: 'x', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }];
const world = (): { chips: MatchChipDef[]; questions: MatchQuestionDef[] } => ({
  chips: [
    { key: 'one', label: 'One', live: true, drivers: [{ column: 'level' }] },
    { key: 'two', label: 'Two', live: true, drivers: [{ column: 'kind', option: 'a' }] },
    { key: 'draft', label: 'Draft', live: false, drivers: [] },
  ],
  questions: [{ key: 'q1', kind: 'limit', whenChips: ['one'], fitRule: { answers: [{ checks: [{ type: 'atLeast', columns: ['level'], value: 8 }] }] }, missMessage: 'Too low', approved: true }],
});

export const TRUTHS: Truth[] = [
  // ======================= Matching =======================
  { id: 'M01', area: 'Matching', says: 'A missed answer or chip can only lower a place\'s score, never raise it.', check: () => {
    for (const fit of [0, 0.25, 0.5, 1, null]) for (const kind of [limit, lean]) {
      const f = matchInterest({ ticked: [chip('X', fit === null ? null : fit * 10)], chipsOffered: 4, answers: [kind(fit)] }).factor;
      if (f > 1 || f <= 0) return fail(`factor ${f} for fit ${fit}`);
    }
    return pass;
  } },
  { id: 'M02', area: 'Matching', says: 'However much is missed, an interest keeps at least the floor (30% by default) of its original score.', check: () => {
    const f = matchInterest({ ticked: [chip('X', 0)], chipsOffered: 4, answers: [limit(0), limit(0), limit(0), lean(0), lean(0)] }).factor;
    return f >= DEFAULT_MATCH_SETTINGS.interestFloor - 1e-9 ? pass : fail(`kept only ${f}`);
  } },
  { id: 'M03', area: 'Matching', says: 'A place with nothing recorded for a chip or a question is never marked down for it.', check: () => {
    const f = matchInterest({ ticked: [chip('X', null)], chipsOffered: 4, answers: [limit(null), lean(null)] }).factor;
    return f === 1 ? pass : fail(`factor ${f}`);
  } },
  { id: 'M04', area: 'Matching', says: 'Ticking no chips, or every chip, asks for nothing in particular and changes nothing.', check: () => {
    const w = world();
    const none = interestMatchFor({ ...w, ticked: [], answers: {}, facts: { level: 0, kind: 'b' }, defs: defs as never }).factor;
    const all = interestMatchFor({ ...w, ticked: ['one', 'two'], answers: {}, facts: { level: 0, kind: 'b' }, defs: defs as never }).factor;
    return none === 1 && all === 1 ? pass : fail(`none ${none}, all ${all}`);
  } },
  { id: 'M05', area: 'Matching', says: 'A question that chips open is ignored until one of those chips is ticked, then it counts.', check: () => {
    const w = world();
    const off = interestMatchFor({ ...w, ticked: [], answers: { q1: [0] }, facts: { level: 0 }, defs: defs as never });
    const on = interestMatchFor({ ...w, ticked: ['one', 'two'].slice(0, 1), answers: { q1: [0] }, facts: { level: 0 }, defs: defs as never });
    return off.checked === 0 && on.checked === 1 ? pass : fail(`off checked ${off.checked}, on checked ${on.checked}`);
  } },
  { id: 'M06', area: 'Matching', says: 'A chip that is still a draft can never be ticked or counted.', check: () => {
    const w = world();
    const r = interestMatchFor({ ...w, ticked: ['draft'], answers: {}, facts: { level: 0 }, defs: defs as never });
    return r.factor === 1 && r.matches.length === 0 ? pass : fail('a draft chip changed a score');
  } },
  { id: 'M07', area: 'Matching', says: 'At most two reason chips show for a place, the biggest loss first, and none for a loss under the threshold.', check: () => {
    const r = matchInterest({ ticked: [chip('Orcas', 0)], chipsOffered: 4, answers: [limit(0, 'A'), lean(0, 'B'), lean(0.9, 'tiny')] });
    if (r.reasons.length > 2) return fail(`${r.reasons.length} reasons`);
    if (r.reasons.some((x) => x.message === 'tiny')) return fail('a tiny loss got a chip');
    for (let i = 1; i < r.reasons.length; i++) if (r.reasons[i].cost > r.reasons[i - 1].cost) return fail('not biggest first');
    return pass;
  } },
  { id: 'M08', area: 'Matching', says: 'Missing a Limit answer costs more than missing a Lean answer, and a missed chip costs at least as much as a missed Limit.', check: () => {
    const s = DEFAULT_MATCH_SETTINGS;
    return s.keepIfLimitMissed < s.keepIfLeanMissed && s.keepIfChipMissed <= s.keepIfLimitMissed ? pass : fail(`chip ${s.keepIfChipMissed}, limit ${s.keepIfLimitMissed}, lean ${s.keepIfLeanMissed}`);
  } },
  { id: 'M09', area: 'Matching', says: 'Answers are kept while a chip is unticked and count again the moment it is ticked again.', check: () => {
    const w = world();
    const a = { q1: [0] };
    const on1 = interestMatchFor({ ...w, ticked: ['one'], answers: a, facts: { level: 0 }, defs: defs as never }).factor;
    const off = interestMatchFor({ ...w, ticked: [], answers: a, facts: { level: 0 }, defs: defs as never }).factor;
    const on2 = interestMatchFor({ ...w, ticked: ['one'], answers: a, facts: { level: 0 }, defs: defs as never }).factor;
    return on1 < 1 && off === 1 && on1 === on2 ? pass : fail(`on ${on1}, off ${off}, on again ${on2}`);
  } },
  { id: 'M10', area: 'Matching', says: 'The built-in matching numbers are all inside their allowed ranges, and the floor sits below what a miss keeps.', check: () => {
    const p = matchSettingsProblem(DEFAULT_MATCH_SETTINGS);
    return p ? fail(p) : pass;
  } },
  { id: 'M11', area: 'Matching', says: 'An unanswered question never lowers a score.', check: () => {
    const w = world();
    const f = interestMatchFor({ ...w, ticked: ['one'], answers: {}, facts: { level: 0 }, defs: defs as never });
    return f.checked === 0 ? pass : fail('an unanswered question was checked');
  } },
  { id: 'M12', area: 'Matching', says: 'The matching numbers saved in the admin are valid, and any left over from the defaults are listed.', check: (ctx) => {
    const merged = mergeMatchSettings(ctx.matchOverride ?? {});
    return matchSettingsProblem(merged) ? fail(matchSettingsProblem(merged)!) : pass;
  } },

  // ======================= Chips and questions =======================
  { id: 'C01', area: 'Chips and questions', says: 'Every chip in the admin is one the owner approved.', check: (ctx) => noneOf(ctx.chips.filter((c) => !approved(c)).map((c) => KEY(c.interestKey, c.label)), 'chips without approval') },
  { id: 'C02', area: 'Chips and questions', says: 'Every question in the admin is one the owner approved.', check: (ctx) => noneOf(ctx.questions.filter((q) => !approved(q)).map((q) => KEY(q.interestKey, q.questionKey)), 'questions without approval') },
  { id: 'C03', area: 'Chips and questions', says: 'No chip the owner rejected or left undecided exists anywhere in the admin.', check: (ctx) => {
    const bad: string[] = [];
    for (const [ik, ck, label] of UNSELECTED_CHIPS) for (const c of ctx.chips) if (c.interestKey === ik && (c.chipKey === ck || c.label.toLowerCase() === label.toLowerCase())) bad.push(`${ik}: ${label}`);
    return noneOf(bad, 'unselected chips are back');
  } },
  { id: 'C04', area: 'Chips and questions', says: 'No answer the owner removed from a question has come back.', check: (ctx) => {
    const bad: string[] = [];
    for (const [ik, qk, text] of REMOVED_ANSWERS) { const q = ctx.questions.find((x) => x.interestKey === ik && x.questionKey === qk); if (q?.options.some((o) => o === text)) bad.push(`${ik} ${qk}: ${text}`); }
    return noneOf(bad, 'removed answers are back');
  } },
  { id: 'C05', area: 'Chips and questions', says: 'Every live chip has a measure of its own, and no live chip is still waiting on a column.', check: (ctx) => noneOf(ctx.chips.filter((c) => c.status === 'live' && (c.drivers.length === 0 || c.needsColumn.trim() !== '')).map((c) => KEY(c.interestKey, c.label)), 'live chips with no measure or a pending column') },
  { id: 'C06', area: 'Chips and questions', says: 'Every chip measure points at a real column of its own interest that can measure a chip.', check: (ctx) => {
    const bad: string[] = [];
    for (const c of ctx.chips) { const d = factDefsFor(c.interestKey); for (const dr of c.drivers) { const p = driverProblem(dr, d); if (p) bad.push(`${c.interestKey}/${c.label}: ${p}`); else if (!canDrive(d.find((x) => x.key === dr.column)!)) bad.push(`${c.label}: ${dr.column} cannot drive`); } }
    return noneOf(bad, 'broken chip measures');
  } },
  { id: 'C07', area: 'Chips and questions', says: `No interest has more than ${MAX_LIVE_CHIPS} live chips.`, check: (ctx) => {
    const n = new Map<string, number>(); for (const c of ctx.chips) if (c.status === 'live') n.set(c.interestKey, (n.get(c.interestKey) ?? 0) + 1);
    return noneOf([...n].filter(([, v]) => v > MAX_LIVE_CHIPS).map(([k, v]) => `${k} has ${v}`), 'interests over the chip limit');
  } },
  { id: 'C08', area: 'Chips and questions', says: 'Every question\'s column rule has exactly one entry per answer, so a reworded or reordered answer list cannot silently shift the checks.', check: (ctx) => noneOf(ctx.questions.filter((q) => q.fitRule && q.fitRule.answers.length !== q.options.length).map((q) => KEY(q.interestKey, q.questionKey)), 'rules that no longer match their answers') },
  { id: 'C09', area: 'Chips and questions', says: 'No question lets a traveler pick more answers than it has.', check: (ctx) => noneOf(ctx.questions.filter((q) => q.maxPicks > q.options.length || q.maxPicks < 1).map((q) => KEY(q.interestKey, q.questionKey)), 'questions with a bad pick limit') },
  { id: 'C10', area: 'Chips and questions', says: 'Every link between a chip and a question joins a chip and a question of the same interest that both exist.', check: (ctx) => {
    const chips = new Set(ctx.chips.map((c) => KEY(c.interestKey, c.chipKey))); const qs = new Set(ctx.questions.map((q) => KEY(q.interestKey, q.questionKey)));
    return noneOf(ctx.links.filter((l) => !chips.has(KEY(l.interestKey, l.chipKey)) || !qs.has(KEY(l.interestKey, l.questionKey))).map((l) => `${l.interestKey} ${l.questionKey}-${l.chipKey}`), 'broken links');
  } },
  { id: 'C11', area: 'Chips and questions', says: 'No question can be stranded: every question that chips open has at least one live chip that opens it.', check: (ctx) => {
    const bad: string[] = [];
    for (const ik of new Set(ctx.questions.map((q) => q.interestKey))) {
      const qs = ctx.questions.filter((q) => q.interestKey === ik).map((q) => ({ key: q.questionKey, whenChips: ctx.links.filter((l) => l.interestKey === ik && l.questionKey === q.questionKey && !l.suggested).map((l) => l.chipKey) }));
      for (const q of questionsWaitingOnDrafts(qs, ctx.chips.filter((c) => c.interestKey === ik).map((c) => ({ key: c.chipKey, live: c.status === 'live' })))) bad.push(`${ik} ${q.key}`);
    }
    return noneOf(bad, 'questions waiting only on draft chips');
  }, pending: 'Many chips are drafts waiting on columns (127 of 180 have no measure). Closes as the chip measures audit is built.' },
  { id: 'C12', area: 'Chips and questions', says: 'Every question that is checked against place columns has a short reason-chip message (40 characters or less).', check: (ctx) => noneOf(ctx.questions.filter((q) => q.fitRule && (q.missMessage.trim() === '' || q.missMessage.length > 40)).map((q) => KEY(q.interestKey, q.questionKey)), 'questions with a missing or long message') },
  { id: 'C13', area: 'Chips and questions', says: 'Every question\'s column rule reads columns that really exist for its interest.', check: (ctx) => {
    const bad: string[] = [];
    for (const q of ctx.questions) { if (!q.fitRule) continue; const keys = new Set(factDefsFor(q.interestKey).map((d) => d.key)); for (const a of q.fitRule.answers) for (const c of a?.checks ?? []) { const cols = ((c as { columns?: string[] }).columns ?? [(c as { column?: string }).column]).filter(Boolean) as string[]; for (const col of cols) if (!keys.has(col)) bad.push(`${q.interestKey} ${q.questionKey}: ${col}`); } }
    return noneOf(bad, 'rules reading missing columns');
  } },
  { id: 'C14', area: 'Chips and questions', says: 'No answer is checked against a rating or choice column that is mostly blank (at least 70% of the interest\'s places have a value).', check: (ctx) => {
    const bad: string[] = [];
    for (const q of ctx.questions) {
      if (!q.fitRule) continue;
      // Rows kept for places where the interest is not applicable do not count: nothing is asked of those places.
      const rows = ctx.facts.filter((f) => f.interestKey === q.interestKey && !ctx.places.find((p) => p.id === f.placeId)?.naSliders.includes(q.interestKey)); if (!rows.length) continue;
      const defs = factDefsFor(q.interestKey);
      const cols = new Set<string>(); for (const a of q.fitRule.answers) for (const c of a?.checks ?? []) for (const col of ((c as { columns?: string[] }).columns ?? [(c as { column?: string }).column]).filter(Boolean) as string[]) cols.add(col);
      for (const col of cols) {
        const def = defs.find((d) => d.key === col); if (!def || !['rating', 'int', 'choice', 'likelihood'].includes(def.type)) continue;
        const have = rows.filter((r) => { const v = r.facts[col]; return v !== undefined && v !== null && v !== ''; }).length;
        if (have / rows.length < 0.7) bad.push(`${q.interestKey} ${q.questionKey}: ${col} ${have}/${rows.length}`);
      }
    }
    return noneOf(bad, 'rating or choice columns that are mostly blank');
  } },
  { id: 'C14b', area: 'Chips and questions', says: 'The text column that a question reads and that should be filled everywhere (Whale "Boat style") is filled for at least 70% of its places. Diving "Signature animals" is left blank on purpose where nothing is worth building a trip around (owner, 24 Oct 2026).', check: (ctx) => {
    const frac = (ik: string, col: string) => { const rows = ctx.facts.filter((f) => f.interestKey === ik); if (!rows.length) return 1; return rows.filter((r) => { const v = r.facts[col]; return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0); }).length / rows.length; };
    const bad = [['whaleWatching', 'boatStyle']].filter(([ik, col]) => frac(ik, col) < 0.7).map(([ik, col]) => `${ik}.${col} ${Math.round(frac(ik, col) * 100)}%`);
    return noneOf(bad, 'columns under 70% filled');
  } },
  { id: 'C15', area: 'Chips and questions', says: 'Every live chip measured on a rating or choice has a value for at least half of the interest\'s places.', check: (ctx) => {
    const bad: string[] = [];
    for (const c of ctx.chips) {
      if (c.status !== 'live') continue; const rows = ctx.facts.filter((f) => f.interestKey === c.interestKey && !ctx.places.find((p) => p.id === f.placeId)?.naSliders.includes(c.interestKey)); if (!rows.length) continue;
      // A blank animal cell or an unticked box means "not a feature here", which is a real answer, so only graded columns count.
      const defs = factDefsFor(c.interestKey); const graded = c.drivers.filter((d) => { const t = defs.find((x) => x.key === d.column); return t && ['rating', 'int', 'choice', 'likelihood'].includes(t.type); }); if (!graded.length) continue;
      const best = Math.max(0, ...graded.map((d) => rows.filter((r) => { const v = r.facts[d.column]; return v !== undefined && v !== null && v !== ''; }).length));
      if (best / rows.length < 0.5) bad.push(`${c.interestKey}/${c.label}: ${best}/${rows.length}`);
    }
    return noneOf(bad, 'live chips measured on under half the places');
  } },

  // ======================= Places and scores =======================
  { id: 'P01', area: 'Places and scores', says: 'Every place has a name, a region and an emoji.', check: (ctx) => noneOf(ctx.places.filter((p) => !p.name.trim() || !p.region.trim() || !p.emoji.trim()).map((p) => p.id), 'places missing a name, region or emoji') },
  { id: 'P02', area: 'Places and scores', says: 'Every score is between 0 and 10, and every curve point is in a month from 1 to 12.', check: (ctx) => {
    const bad: string[] = [];
    for (const p of ctx.places) {
      for (const [k, v] of Object.entries(p.baseScores)) if (typeof v === 'number' && (v < 0 || v > 10)) bad.push(`${p.id} base ${k} ${v}`);
      for (const [k, c] of Object.entries(p.curves)) for (const a of c.anchors ?? []) if (a.value < 0 || a.value > 10 || a.month < 1 || a.month > 12) bad.push(`${p.id} ${k} month ${a.month} value ${a.value}`);
    }
    return noneOf(bad, 'out-of-range scores');
  } },
  { id: 'P03', area: 'Places and scores', says: 'Every place marked not applicable for Safari, Diving, Surfing or Whale Watching has a stored reason.', check: (ctx) => {
    const bad: string[] = [];
    for (const p of ctx.places) for (const k of ['safari', 'diving', 'surfing', 'whaleWatching']) if (p.naSliders.includes(k) && !p.naReasons?.[k]?.reason) bad.push(`${p.name} (${k})`);
    return noneOf(bad, 'N/A marks without a reason');
  } },
  { id: 'P04', area: 'Places and scores', says: 'No place, score or flag mentions an interest that was removed (Spectator Sports is now part of Festivals).', check: (ctx) => {
    const bad: string[] = [];
    for (const p of ctx.places) for (const key of REMOVED_INTERESTS) {
      if (p.naSliders.includes(key) || key in p.baseScores || key in p.curves || key in p.overview || key in p.monthly || key in (p.naReasons ?? {})) bad.push(`${p.name}: ${key}`);
    }
    return noneOf(bad, 'places still mention a removed interest');
  } },
  { id: 'P05', area: 'Places and scores', says: 'Hidden interests (Landscape Photography) are never offered in the interest picker, and removed ones are gone from it.', check: () => {
    const keys = pickerInterests().map((i) => i.key);
    const bad = ['landscapePhotography', ...REMOVED_INTERESTS].filter((k) => keys.includes(k));
    return bad.length ? fail(`in the picker: ${bad.join(', ')}`) : pass;
  } },
  { id: 'P06', area: 'Places and scores', says: 'The Wildflowers interest is called "Blooms and Fall Colors", shown as "Blooms & Colors" on the pill.', check: () => {
    const i = pickerInterests().find((x) => x.key === 'wildflowerBlooms');
    return i && /Blooms/.test(i.label) ? pass : fail(`label is "${i?.label}"`);
  } },
  { id: 'P07', area: 'Places and scores', says: 'The Red Sea & Nile is among the ten best places for diving.', check: (ctx) => {
    const peak = (p: (typeof ctx.places)[number]) => Math.max(0, ...(p.curves.diving?.anchors ?? []).map((a) => a.value));
    const rank = [...ctx.places].filter((p) => !p.naSliders.includes('diving')).sort((a, b) => peak(b) - peak(a)).findIndex((p) => /red sea/i.test(p.name));
    return rank >= 0 && rank < 10 ? pass : fail(rank < 0 ? 'not found' : `ranks ${rank + 1}`);
  } },
  { id: 'P09', area: 'Places and scores', says: 'The coast rule holds: a place scored for Surfing also has Beaches & Swimming switched on, and a place close enough to the ocean to have a surf or beach score is close enough to be considered for diving. It can be not applicable for murky water or no diving, but never for being "too far from the coast". (River and city swimming that has nothing to do with the ocean is not covered.)', check: (ctx) => {
    const on = (p: (typeof ctx.places)[number], k: string) => !p.naSliders.includes(k);
    const bad: string[] = [];
    for (const p of ctx.places) {
      if (on(p, 'surfing') && !on(p, 'beachesSwimming')) bad.push(`${p.name}: scored for surfing but no beaches`);
      if (on(p, 'diving') || (!on(p, 'surfing') && !on(p, 'beachesSwimming'))) continue;
      if (COASTAL_WITHOUT_SURF.includes(p.id) || INLAND_SWIMMING.includes(p.id)) continue;
      const reason = ((p.naReasons as Record<string, { reason?: string }> | null)?.diving?.reason) ?? '';
      if (!reason) bad.push(`${p.name}: diving is not applicable with no reason written down`);
      else if (TOO_FAR.test(reason)) bad.push(`${p.name}: diving is not applicable for being too far, yet it has a surf or beach score`);
    }
    return noneOf(bad, 'places that break the coast rule');
  } },
  { id: 'P10', area: 'Places and scores', says: 'Every place has both its peak crowd intensity and its seasonal price swing set (Crowds & prices reads them separately).', check: (ctx) => noneOf(ctx.places.filter((p) => !p.peakIntensity || !p.priceSwing).map((p) => p.name), 'places missing a peak crowd intensity or a price swing') },
  { id: 'P08', area: 'Places and scores', says: 'The Red Sea & Nile counts as a wreck-diving destination (its famous wrecks are recorded).', check: (ctx) => {
    const p = ctx.places.find((x) => /red sea/i.test(x.name)); const f = p && ctx.facts.find((r) => r.placeId === p.id && r.interestKey === 'diving');
    const draw = (f?.facts.drawType as string[] | undefined) ?? [];
    return draw.includes('wrecks') ? pass : fail(`its dive draw is recorded as: ${draw.join(', ') || 'nothing'}`);
  }, pending: 'Needs the "Wreck diving rating" column (chip measures audit, item C1). Today the chip reads only the main draw.' },

  // ======================= Facts =======================
  { id: 'F01', area: 'Facts', says: 'Every stored fact is a legal value for its column: ratings 0 to 10, choices and lists from the allowed options.', check: (ctx) => {
    const bad: string[] = [];
    for (const r of ctx.facts) {
      const defs = factDefsFor(r.interestKey); if (!defs.length) continue;
      for (const [k, v] of Object.entries(r.facts)) {
        const d = defs.find((x) => x.key === k); if (!d || v === null || v === undefined) continue;
        if (d.type === 'rating' && (typeof v !== 'number' || v < 0 || v > 10)) bad.push(`${r.placeId} ${r.interestKey}.${k}=${JSON.stringify(v).slice(0, 20)}`);
        else if (d.type === 'choice' && typeof v === 'string' && v !== '' && !(d.options ?? []).some((o) => o.value === v)) bad.push(`${r.placeId} ${r.interestKey}.${k}="${v}"`);
        else if (d.type === 'multi' && Array.isArray(v) && v.some((x) => !(d.options ?? []).some((o) => o.value === x))) bad.push(`${r.placeId} ${r.interestKey}.${k}=${JSON.stringify(v).slice(0, 30)}`);
        else if (d.type === 'bool' && typeof v !== 'boolean') bad.push(`${r.placeId} ${r.interestKey}.${k}`);
      }
    }
    return noneOf(bad, 'facts with an illegal value');
  } },
  { id: 'F02', area: 'Facts', says: 'No fact is stored under a column name that does not exist for its interest.', check: (ctx) => {
    const bad = new Set<string>();
    for (const r of ctx.facts) { const keys = new Set(factDefsFor(r.interestKey).map((d) => d.key)); if (!keys.size) continue; for (const k of Object.keys(r.facts)) if (!keys.has(k)) bad.add(`${r.interestKey}.${k}`); }
    return noneOf([...bad], 'unknown column names in saved facts');
  } },
  { id: 'F03', area: 'Facts', says: 'Water temperatures for Diving and Surfing are written so a number can be read from them (for example "54-79 F").', check: (ctx) => {
    const bad: string[] = [];
    for (const r of ctx.facts) if ((r.interestKey === 'diving' || r.interestKey === 'surfing') && typeof r.facts.waterTemp === 'string' && r.facts.waterTemp.trim() && lowestTempF(r.facts.waterTemp) === null) bad.push(`${r.placeId}: "${r.facts.waterTemp.slice(0, 30)}"`);
    return noneOf(bad, 'water temperatures the matching cannot read');
  } },
  { id: 'F04', area: 'Facts', says: 'Every safari place has an odds entry for "Great herds" (the migration chip measures it).', check: (ctx) => noneOf(ctx.facts.filter((r) => r.interestKey === 'safari' && !r.facts.herds).map((r) => r.placeId), 'safari places without a Great herds entry'),
    pending: 'Safari to-do: Great herds is filled for 15 of 17 places (28 Oct 2026, sources in docs/evidence/safari-great-herds-evidence.json); Nepal and Uganda stay blank until a herd-size source is found (chip measures audit, item L5).' },
  // ======================= Text =======================
  { id: 'T01', area: 'Text', says: 'Every bird we name is written in Title Case in the live text ("Atlantic Puffin", not "atlantic puffin").', check: (ctx) => {
    const bad: string[] = [];
    for (const p of ctx.places) for (const k of SPECIES_CASE_INTERESTS) for (const t of [p.overview[k], ...(p.monthly[k] ?? [])]) if (t) for (const x of birdCaseProblems(t)) bad.push(`${p.name}: ${x.found}`);
    return noneOf(bad, 'bird names in the wrong case');
  } },
  { id: 'T02', area: 'Text', says: 'Species-name markers (**) are balanced in every live text.', check: (ctx) => {
    const bad: string[] = [];
    for (const p of ctx.places) for (const [k, t] of Object.entries(p.overview)) if (t && !emphasisIsBalanced(t)) bad.push(`${p.name} ${k}`);
    return noneOf(bad, 'overviews with unbalanced markers');
  } },
  { id: 'T03', area: 'Text', says: 'Live texts use US units (miles, feet, degrees F), never kilometers, meters or degrees C on their own.', check: (ctx) => {
    const re = /\b\d[\d,.]*\s?(km|kilomet\w*|°C|degrees C(?:elsius)?|metres?|meters?)\b/i; const bad: string[] = [];
    for (const p of ctx.places) for (const [k, t] of Object.entries(p.overview)) if (t && re.test(t)) bad.push(`${p.name} ${k}: ${t.match(re)![0]}`);
    return noneOf(bad, 'overviews with metric units');
  } },
  { id: 'T04', area: 'Text', says: 'Live texts use US spelling (color, center, neighbor), not UK spelling. Proper names such as "Wetland Centre" are left alone.', check: (ctx) => {
    const re = /\b(colour\w*|favour\w*|neighbour\w*|kilometre\w*|metres?|programme\w*|travelling|labour|honour\w*|theatre|licence|centre|harbour\w*)\b/; const bad: string[] = [];
    for (const p of ctx.places) for (const [k, t] of Object.entries(p.overview)) { const m = t?.match(re); if (m) bad.push(`${p.name} ${k}: ${m[0]}`); }
    return noneOf(bad, 'overviews with UK spelling');
  } },
  { id: 'T05', area: 'Text', says: 'Animal names use American spelling ("gray seal", "Gray Heron"), the way eBird and NOAA write them.', check: (ctx) => {
    const re = /\b[Gg]rey\b/; const bad: string[] = [];
    for (const p of ctx.places) for (const [k, t] of Object.entries(p.overview)) if (t && re.test(t)) bad.push(`${p.name} ${k}`);
    return noneOf(bad, 'overviews that write "grey"');
  } },
  { id: 'T06', area: 'Text', says: 'Bird names are the eBird names: a name swept out on 22 Oct 2026 (Common Starling, Griffon Vulture, Little Auk and the rest) never comes back.', check: (ctx) => {
    const bad: string[] = [];
    for (const p of ctx.places) for (const k of SPECIES_CASE_INTERESTS) for (const t of [p.overview[k], ...(p.monthly[k] ?? [])]) if (t) for (const x of retiredBirdNames(t)) bad.push(`${p.name}: ${x.found} (now ${x.use})`);
    return noneOf(bad, 'texts with an older bird name');
  } },

  // ======================= Admin =======================
  { id: 'A01', area: 'Admin', says: 'Everything the owner approved records who approved it and when.', check: (ctx) => noneOf([...ctx.chips.filter((c) => approved(c) && !c.approvedBy.trim()).map((c) => `chip ${c.interestKey}/${c.label}`), ...ctx.questions.filter((q) => approved(q) && !q.approvedBy.trim()).map((q) => `question ${q.interestKey}/${q.questionKey}`)], 'approvals with no approver') },
  { id: 'A02', area: 'Admin', says: 'Every to-do marked done has a done date.', check: (ctx) => noneOf(ctx.todos.filter((t) => t.status === 'done' && !t.doneAt).map((t) => t.id.slice(0, 6)), 'done to-dos without a date') },
  { id: 'A03', area: 'Admin', says: 'Every question\'s fit rule that is saved was written for the answers it has now (a rule never outlives a change to the answer list).', check: (ctx) => noneOf(ctx.questions.filter((q) => q.fitRule && q.fitRule.answers.length !== q.options.length).map((q) => KEY(q.interestKey, q.questionKey)), 'stale rules') },
  { id: 'A04', area: 'Admin', says: 'The code\'s own list of column rules and the saved rules agree (nothing was edited in one place only).', check: (ctx) => {
    const bad: string[] = [];
    for (const [id, rule] of Object.entries(QUESTION_FIT_RULES)) { const [ik, qk] = id.split('.'); const q = ctx.questions.find((x) => x.interestKey === ik && x.questionKey === qk); if (!q?.fitRule) bad.push(`${id}: not saved`); else if (canon(q.fitRule) !== canon(rule)) bad.push(`${id}: differs`); }
    return noneOf(bad, 'rules that differ between code and admin');
  } },
];

export interface TruthOutcome { truth: Truth; status: 'pass' | 'fail' | 'pending' | 'fixed'; detail?: string }

/** Runs every truth. A pending truth that now passes is reported as `fixed`, so the pending note gets removed. */
export function runTruths(ctx: TruthContext): TruthOutcome[] {
  return TRUTHS.map((truth) => {
    let r: TruthResult;
    try { r = truth.check(ctx); } catch (e) { r = fail(`the check itself broke: ${(e as Error).message}`); }
    if (r.ok) return { truth, status: truth.pending ? 'fixed' : 'pass' } as TruthOutcome;
    return { truth, status: truth.pending ? 'pending' : 'fail', detail: r.detail } as TruthOutcome;
  });
}
