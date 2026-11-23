/**
 * 9 Nov 2026: the one list of steps every interest written by Gemini must have, and the pure function that says which are done.
 * Facts come from the database (scripts/interest-status.ts); nothing here reads it. Steps whose "done" cannot be told from the app yet
 * (the owner's own marks, which still live in the tracker artifact) come back as 'unknown' until they move into the app.
 */
export type StepState = 'done' | 'gap' | 'info' | 'unknown';
export type StepOwner = 'claude' | 'owner';

export interface WordingHits {
  /** Places whose saved text contains the pattern. */
  filler: number;
  offers: number;
  promo: number;
  contrast: number;
  thisInterest: number;
  total: number;
}

export interface InterestFacts {
  key: string;
  label: string;
  /** Written through the shared family directive (current rules apply in full); false for the older per-interest directives. */
  family: boolean;
  /** Has at least one authoring pass or Gemini-origin text. */
  authored: boolean;
  applicable: number;
  text: number;
  passes: number;
  passesFinished: number;
  factNoteOn: string;
  ownerReviews: number;
  ruleSections: number;
  handBuiltRules: boolean;
  na: number;
  naReason: number;
  defs: number;
  chips: number;
  chipsLive: number;
  chipsApproved: number;
  questions: number;
  questionsApproved: number;
  planningApproved: boolean;
  wording: WordingHits;
}

export interface StepResult {
  id: string;
  label: string;
  owner: StepOwner;
  state: StepState;
  detail: string;
}

const pct = (a: number, b: number) => (b === 0 ? 0 : a / b);

/** Steps in the order they are normally done. */
export function evaluateInterest(f: InterestFacts): StepResult[] {
  const out: StepResult[] = [];
  const add = (id: string, label: string, owner: StepOwner, state: StepState, detail: string) => out.push({ id, label, owner, state, detail });

  add('text', 'Texts and scores saved for the applicable places', 'claude', pct(f.text, f.applicable) >= 0.9 ? 'done' : 'gap', `${f.text} of ${f.applicable} places have text`);
  add('pass', 'Authoring pass recorded and finished', 'claude', f.passes > 0 && f.passesFinished === f.passes ? 'done' : 'gap', f.passes === 0 ? 'no pass recorded' : `${f.passesFinished} of ${f.passes} passes finished`);
  add('factnote', 'Dated fact-check note on the interest page', 'claude', f.factNoteOn ? 'done' : 'gap', f.factNoteOn ? `done ${f.factNoteOn}` : 'no dated whole-interest note');
  add('rules', 'Rules page filled in (scope, writing rules, scoring, lessons)', 'claude', f.handBuiltRules || f.ruleSections >= 4 ? 'done' : 'gap', f.handBuiltRules ? 'hand-built page' : `${f.ruleSections} rule sections`);
  const w = f.wording;
  const wordingDetail = `${w.total} places hit a wording rule (offer ${w.offers}, year-round filler ${w.filler}, promotional ${w.promo}, contrast ${w.contrast}, "this interest" ${w.thisInterest})`;
  add('wording', 'Saved texts clean of the wording rules', 'claude', w.total === 0 ? 'done' : f.family ? 'gap' : 'info', f.family ? wordingDetail : `${wordingDetail}; older directive, owner has not ruled whether the new rules apply`);
  add('na', 'N/A reasons stored for every N/A place', 'claude', f.na === f.naReason ? 'done' : 'gap', `${f.naReason} of ${f.na} N/A places have a reason`);
  add('columns', 'Interest columns designed', 'claude', f.defs > 0 ? 'done' : 'gap', `${f.defs} columns`);
  add('chips', 'Chips and questions approved and live', 'claude', f.chips > 0 && f.chipsLive === f.chips && f.questions > 0 && f.questionsApproved === f.questions ? 'done' : 'gap', `${f.chipsLive} of ${f.chips} chips live, ${f.questionsApproved} of ${f.questions} questions approved`);
  add('planning', 'Planning scores approved', 'claude', f.planningApproved ? 'done' : 'gap', f.planningApproved ? 'approved' : 'not approved');
  add('ownerReview', 'Your review recorded on the interest page', 'owner', f.ownerReviews > 0 ? 'done' : 'gap', f.ownerReviews > 0 ? `${f.ownerReviews} recorded` : 'not recorded in the app (the tracker has it)');
  add('ownerMarks', 'Reviewed mark and both rank checks', 'owner', 'unknown', 'kept in the tracker for now; moves into the app with step 2 of the plan');
  return out;
}

export function isAuthored(f: Pick<InterestFacts, 'passes' | 'text'> & { gemini?: number }): boolean {
  return f.passes > 0 || (f.gemini ?? 0) > 0;
}

export function summarize(results: StepResult[]): { gaps: StepResult[]; info: StepResult[]; unknown: StepResult[] } {
  return { gaps: results.filter((r) => r.state === 'gap'), info: results.filter((r) => r.state === 'info'), unknown: results.filter((r) => r.state === 'unknown') };
}
