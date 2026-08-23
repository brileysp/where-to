/**
 * Adapts the legacy vanilla-JS app's real content (cards.js, domains.js,
 * dimensions.js, tensions.js — copied verbatim into scripts/legacy/) into
 * the typed shapes src/lib/dna/*.ts expects, so tests can run the SAME
 * card/domain/dimension/tension data through both the legacy engine and
 * the new port and diff the outputs directly. Using one shared data
 * source for both sides (rather than e.g. Postgres-round-tripped data for
 * the new side) isolates these tests to "is the algorithm identical" —
 * exactly Phase 4's stated goal — without a migration-adaptation quirk
 * confounding the comparison.
 */
import * as legacy from '../../scripts/legacy/traveldna.js';
import { EXPERIENCE_CARDS } from '../../scripts/legacy/cards.js';
import { DOMAIN_REGISTRY } from '../../scripts/legacy/domains.js';
import { DIMENSIONS } from '../../scripts/legacy/dimensions.js';
import { TENSION_LIBRARY } from '../../scripts/legacy/tensions.js';
import type { DimensionDef, DnaCard, DomainDef, TensionDef } from '@/lib/dna/types';

interface LegacyCard {
  id: string;
  short: string;
  title: string;
  description: string;
  category: string;
  tags?: string[];
  preferenceSignals?: Record<string, number>;
  dimensionSignals?: Record<string, number>;
  stage?: 'broad' | 'deep';
  domain?: string;
  niche?: boolean;
  subdimensions?: string[];
  sampleDestinations?: string[];
  unlockConditions?: { minimumPositiveSwipes: number; minimumLoveSwipes: number };
  diagnosticPurpose?: string;
}

export const cards: DnaCard[] = (EXPERIENCE_CARDS as unknown as LegacyCard[]).map((c) => ({
  id: c.id,
  short: c.short,
  title: c.title,
  description: c.description,
  category: c.category,
  tags: c.tags ?? [],
  preferenceSignals: c.preferenceSignals ?? {},
  dimensionSignals: c.dimensionSignals ?? {},
  stage: c.stage ?? 'broad',
  domain: c.domain ?? null,
  niche: c.niche ?? false,
  subdimensions: c.subdimensions ?? null,
  sampleDestinations: c.sampleDestinations ?? null,
  unlockMinPositive: c.unlockConditions?.minimumPositiveSwipes ?? null,
  unlockMinLove: c.unlockConditions?.minimumLoveSwipes ?? null,
  diagnosticPurpose: c.diagnosticPurpose ?? null,
}));

interface LegacyDomain {
  key: string;
  label?: string;
  emoji?: string;
  matchCategories?: string[];
  matchTags?: string[];
  subdimensions?: string[];
  unlock?: { minPositive: number; minLove: number };
  transitionCard?: { title: string; body: string };
  hasDeepCards?: boolean;
}

export const domains: DomainDef[] = Object.values(DOMAIN_REGISTRY as Record<string, LegacyDomain>).map((d) => ({
  key: d.key,
  label: d.label ?? d.key,
  emoji: d.emoji ?? null,
  matchCategories: d.matchCategories ?? [],
  matchTags: d.matchTags ?? [],
  hasDeepCards: d.hasDeepCards ?? false,
  subdimensions: d.subdimensions ?? [],
  unlockMinPositive: d.unlock?.minPositive ?? null,
  unlockMinLove: d.unlock?.minLove ?? null,
  transitionTitle: d.transitionCard?.title ?? null,
  transitionBody: d.transitionCard?.body ?? null,
}));

export const dimensions: DimensionDef[] = DIMENSIONS as DimensionDef[];

interface LegacyTension {
  id: string;
  title: string;
  insightText: string;
  recommendationImplication?: string;
  relatedDimensions?: string[];
  signalA: TensionDef['signalA'];
  signalB: TensionDef['signalB'];
}

export const tensions: TensionDef[] = (TENSION_LIBRARY as LegacyTension[]).map((t) => ({
  id: t.id,
  title: t.title,
  insightText: t.insightText,
  recommendationImplication: t.recommendationImplication ?? null,
  relatedDimensions: t.relatedDimensions ?? [],
  signalA: t.signalA,
  signalB: t.signalB,
}));

export { legacy };

/** Deterministic PRNG (mulberry32) so a test can drive `Math.random()` with an identical sequence on both sides. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
