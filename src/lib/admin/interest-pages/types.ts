import type { InterestChipDriver, InterestChipStatus, InterestFactValue, InterestIdeaStage, InterestTodoStatus, ReferenceSiteAccess } from '@/lib/db/schema';
import type { FactDef } from './config';
import type { Completeness } from './completeness';
import type { PlaceType } from './place-types';

export type PlaceStatus = 'live' | 'staged' | 'none' | 'na';

/** Why a place is not applicable for this interest (places.naReasons[interest]). */
export interface NaReasonInfo {
  reason: string;
  source: 'gemini' | 'imported' | 'manual';
  /** Who or what wrote it: a model name, an import note, or an admin email. */
  by: string;
  at: string;
  /** The model's original wording, kept when an admin has edited the reason. */
  geminiText?: string;
}

export interface InterestPlaceRow {
  id: string;
  name: string;
  region: string;
  /** 12 monthly scores for this interest (Jan-Dec). */
  monthly: number[];
  status: PlaceStatus;
  /** Only for N/A places; null when no reason has been recorded. */
  naReason: NaReasonInfo | null;
  /** One of the ten place types used for the rankings. */
  placeType: PlaceType;
  facts: Record<string, InterestFactValue>;
  /** The written overview for this interest, empty when there is none. */
  overview: string;
  /** The 12 monthly blurbs for this interest (null = none written). */
  monthlyText: (string | null)[];
  /** A staged Gemini draft waiting to go live, when status is 'staged'. */
  stagedGenerationId: string | null;
}

export interface ReviewRow {
  id: string;
  placeId: string | null;
  reviewerName: string;
  reviewerRole: string | null;
  reviewedOn: string; // YYYY-MM-DD
  notes: string;
  createdBy: string;
  createdAt: string;
}

export interface ReferenceSiteRow {
  id: string;
  siteUrl: string;
  label: string;
  goodFor: string;
  /** 1-100, 100 = best. */
  usefulness: number;
  aiAccess: ReferenceSiteAccess;
  lastUsedOn: string | null; // YYYY-MM-DD
  placesChecked: number;
  createdAt: string;
}

export interface TodoRow {
  id: string;
  title: string;
  detail: string;
  status: InterestTodoStatus;
  source: string;
  /** The place this to-do is about, when it is about one. */
  placeId: string | null;
  /** When on, applying a Gemini draft for that place and this interest closes the to-do by itself. */
  closeOnApply: boolean;
  /** 1 = high, 2 = normal, 3 = low. */
  priority: number;
  /** "Check on" date (YYYY-MM-DD), or null. */
  dueOn: string | null;
  repeatEvery: 'weekly' | 'monthly' | null;
  createdAt: string;
  doneAt: string | null;
}

export interface IdeaRow {
  id: string;
  name: string;
  region: string;
  why: string;
  nearestExisting: string;
  placeType: string;
  stage: InterestIdeaStage;
  /** Place grain, -2 (too specific) to 2 (too broad); null = not rated. See grain.ts. */
  grain: number | null;
  grainNote: string;
  /** Manual order (lower first); null = unordered. */
  sortOrder: number | null;
  /** Set once the idea has been turned into a real place. */
  promotedPlaceId: string | null;
  createdAt: string;
}

export interface AuthoringBatchRow {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  places: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  model: string | null;
  promptVersion: string | null;
  thinkingLevel: string | null;
  valid: number;
  invalid: number;
  notApplicable: number;
  applied: number;
}

/** One named round of Gemini authoring for this interest (docs/authoring-passes-spec.md). */
export interface AuthoringPassRow {
  id: string;
  label: string;
  kind: 'initial' | 'redo' | 'targeted' | 'pilot';
  promptVersion: string | null;
  notes: string;
  /** Set when the pass is marked finished; null = in progress. */
  finishedAt: string | null;
  startedAt: string;
  lastActivityAt: string;
  places: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  batches: AuthoringBatchRow[];
}

/** A sub-interest chip for this interest (see chips.ts). */
export interface ChipRow {
  key: string;
  label: string;
  order: number;
  status: InterestChipStatus;
  drivers: InterestChipDriver[];
  /** Filled in while the chip waits on a column that has not been added yet. */
  needsColumn: string;
}

/** A fit typed by hand for one place and chip. */
export interface ChipOverrideRow {
  chipKey: string;
  placeId: string;
  fit: number;
  reason: string;
  setBy: string;
  setAt: string;
}

export interface InterestPageData {
  key: string;
  label: string;
  icon: string;
  group: string;
  formula: string;
  audienceTier: string | null;
  anchor: { definition: string; ten: Array<{ id: string; name: string }> } | null;
  directive: string | null; // e.g. "prompts/birding/v8.md"
  places: InterestPlaceRow[];
  placeOptions: Array<{ id: string; name: string }>;
  factDefs: FactDef[];
  reviews: ReviewRow[];
  referenceSites: ReferenceSiteRow[];
  todos: TodoRow[];
  ideas: IdeaRow[];
  completeness: Completeness;
  passes: AuthoringPassRow[];
  chips: ChipRow[];
  chipOverrides: ChipOverrideRow[];
  /** Admin-edited versions of Rules & scoring lists, keyed by section (e.g. "birding.ladder"). A missing key uses the built-in list. */
  ruleOverrides: Record<string, unknown[]>;
  /** Every interest, for the picker at the top of the page. */
  interestOptions: Array<{ key: string; label: string; icon: string; group: string }>;
}
