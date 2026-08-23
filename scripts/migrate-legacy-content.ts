import { db } from '../src/lib/db/client';
import { cards, domains, subdimensions, dimensions, tensions } from '../src/lib/db/schema';
import { DOMAIN_REGISTRY } from './legacy/domains.js';
import { EXPERIENCE_CARDS } from './legacy/cards.js';
import { DIMENSIONS } from './legacy/dimensions.js';
import { TENSION_LIBRARY } from './legacy/tensions.js';

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

interface LegacyCard {
  id: string;
  short: string;
  title: string;
  description: string;
  category: string;
  tags?: string[];
  imagePrompt?: string;
  preferenceSignals?: Record<string, number>;
  dimensionSignals?: Record<string, number>;
  stage?: 'broad' | 'deep';
  domain?: string;
  niche?: boolean;
  subdimensions?: string[];
  sampleDestinations?: string[];
  unlockConditions?: { domain: string; minimumPositiveSwipes: number; minimumLoveSwipes: number };
  diagnosticPurpose?: string;
}

interface LegacyDimension {
  id: string;
  label: string;
  poleA: string;
  poleB: string;
  keyA: string;
  keyB: string;
  summaryA: string;
  summaryB: string;
  question: string;
}

interface LegacySignal {
  label: string;
  type: 'profile' | 'dimensionPole' | 'rejectedAttrs';
  keys: string[];
  min: number;
}

interface LegacyTension {
  id: string;
  title: string;
  insightText: string;
  recommendationImplication?: string;
  relatedDimensions?: string[];
  signalA: LegacySignal;
  signalB: LegacySignal;
}

async function main() {
  console.log('Clearing existing content tables...');
  await db.delete(subdimensions);
  await db.delete(cards);
  await db.delete(domains);
  await db.delete(dimensions);
  await db.delete(tensions);

  // ---- Domains + subdimensions --------------------------------------------
  const domainEntries = Object.values(DOMAIN_REGISTRY) as LegacyDomain[];
  console.log(`Migrating ${domainEntries.length} domains...`);
  for (const d of domainEntries) {
    await db.insert(domains).values({
      key: d.key,
      label: d.label ?? d.key, // stub domains have no label — key is already readable
      emoji: d.emoji ?? null,
      hasDeepCards: d.hasDeepCards ?? false,
      matchCategories: d.matchCategories ?? [],
      matchTags: d.matchTags ?? [],
      unlockMinPositive: d.unlock?.minPositive ?? null,
      unlockMinLove: d.unlock?.minLove ?? null,
      transitionTitle: d.transitionCard?.title ?? null,
      transitionBody: d.transitionCard?.body ?? null,
    });

    if (d.subdimensions && d.subdimensions.length > 0) {
      for (let i = 0; i < d.subdimensions.length; i++) {
        await db.insert(subdimensions).values({
          domainKey: d.key,
          name: d.subdimensions[i],
          ordinal: i,
        });
      }
    }
  }

  // ---- Cards ----------------------------------------------------------------
  const legacyCards = EXPERIENCE_CARDS as unknown as LegacyCard[];
  console.log(`Migrating ${legacyCards.length} cards...`);
  for (const c of legacyCards) {
    await db.insert(cards).values({
      id: c.id,
      short: c.short,
      title: c.title,
      description: c.description,
      category: c.category,
      tags: c.tags ?? [],
      imagePrompt: c.imagePrompt ?? null,
      preferenceSignals: c.preferenceSignals ?? {},
      dimensionSignals: c.dimensionSignals ?? {},
      stage: c.stage ?? 'broad',
      domainKey: c.domain ?? null,
      niche: c.niche ?? false,
      cardSubdimensions: c.subdimensions ?? null,
      sampleDestinations: c.sampleDestinations ?? null,
      unlockMinPositive: c.unlockConditions?.minimumPositiveSwipes ?? null,
      unlockMinLove: c.unlockConditions?.minimumLoveSwipes ?? null,
      diagnosticPurpose: c.diagnosticPurpose ?? null,
    });
  }

  // ---- Dimensions -------------------------------------------------------------
  const legacyDimensions = DIMENSIONS as LegacyDimension[];
  console.log(`Migrating ${legacyDimensions.length} dimensions...`);
  for (const dim of legacyDimensions) {
    await db.insert(dimensions).values({
      id: dim.id,
      label: dim.label,
      poleA: dim.poleA,
      poleB: dim.poleB,
      keyA: dim.keyA,
      keyB: dim.keyB,
      summaryA: dim.summaryA,
      summaryB: dim.summaryB,
      question: dim.question,
    });
  }

  // ---- Tensions ---------------------------------------------------------------
  const legacyTensions = TENSION_LIBRARY as LegacyTension[];
  console.log(`Migrating ${legacyTensions.length} tensions...`);
  for (const t of legacyTensions) {
    await db.insert(tensions).values({
      id: t.id,
      title: t.title,
      insightText: t.insightText,
      recommendationImplication: t.recommendationImplication ?? null,
      relatedDimensionIds: t.relatedDimensions ?? [],
      signalA: t.signalA,
      signalB: t.signalB,
    });
  }

  const [domainCount, subdimCount, cardCount, dimCount, tensionCount] = await Promise.all([
    db.select().from(domains),
    db.select().from(subdimensions),
    db.select().from(cards),
    db.select().from(dimensions),
    db.select().from(tensions),
  ]);

  console.log(
    `Done. ${domainCount.length} domains, ${subdimCount.length} subdimensions, ${cardCount.length} cards, ${dimCount.length} dimensions, ${tensionCount.length} tensions.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
