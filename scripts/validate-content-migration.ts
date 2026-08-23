import { db } from '../src/lib/db/client';
import { cards, domains, subdimensions, dimensions, tensions } from '../src/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { DOMAIN_REGISTRY } from './legacy/domains.js';
import { EXPERIENCE_CARDS } from './legacy/cards.js';
import { DIMENSIONS } from './legacy/dimensions.js';
import { TENSION_LIBRARY } from './legacy/tensions.js';

/**
 * Structural equality, not string equality — Postgres's JSONB storage
 * does not preserve object key insertion order (it normalizes keys
 * internally), so a plain JSON.stringify comparison flags byte-identical
 * data as a mismatch purely because of key order. Arrays stay
 * order-sensitive (correct — e.g. subdimension ordinal, tag order).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length || !aKeys.every((k, i) => k === bKeys[i])) return false;
    return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
  }
  return a === b;
}

function report(failures: string[], label: string, expected: unknown, actual: unknown) {
  if (!deepEqual(expected, actual)) {
    failures.push(label);
    console.error(`MISMATCH: ${label}`);
    console.error('  legacy:', JSON.stringify(expected));
    console.error('  new:   ', JSON.stringify(actual));
  }
}

async function main() {
  const failures: string[] = [];

  // ---- Domains + subdimensions --------------------------------------------
  const domainRows = await db.select().from(domains);
  const legacyDomainEntries = Object.values(DOMAIN_REGISTRY) as Array<{
    key: string;
    label?: string;
    emoji?: string;
    matchCategories?: string[];
    matchTags?: string[];
    subdimensions?: string[];
    unlock?: { minPositive: number; minLove: number };
    transitionCard?: { title: string; body: string };
    hasDeepCards?: boolean;
  }>;

  if (domainRows.length !== legacyDomainEntries.length) {
    failures.push('domain count');
    console.error(`MISMATCH: domain count — legacy ${legacyDomainEntries.length}, new ${domainRows.length}`);
  }

  for (const legacy of legacyDomainEntries) {
    const row = domainRows.find((r) => r.key === legacy.key);
    if (!row) {
      failures.push(`domain missing: ${legacy.key}`);
      console.error(`MISSING domain: ${legacy.key}`);
      continue;
    }
    report(failures, `domain ${legacy.key} label`, legacy.label ?? legacy.key, row.label);
    report(failures, `domain ${legacy.key} emoji`, legacy.emoji ?? null, row.emoji);
    report(failures, `domain ${legacy.key} hasDeepCards`, legacy.hasDeepCards ?? false, row.hasDeepCards);
    report(failures, `domain ${legacy.key} matchCategories`, legacy.matchCategories ?? [], row.matchCategories);
    report(failures, `domain ${legacy.key} matchTags`, legacy.matchTags ?? [], row.matchTags);
    report(failures, `domain ${legacy.key} unlockMinPositive`, legacy.unlock?.minPositive ?? null, row.unlockMinPositive);
    report(failures, `domain ${legacy.key} unlockMinLove`, legacy.unlock?.minLove ?? null, row.unlockMinLove);
    report(failures, `domain ${legacy.key} transitionTitle`, legacy.transitionCard?.title ?? null, row.transitionTitle);
    report(failures, `domain ${legacy.key} transitionBody`, legacy.transitionCard?.body ?? null, row.transitionBody);

    const subRows = await db
      .select()
      .from(subdimensions)
      .where(eq(subdimensions.domainKey, legacy.key))
      .orderBy(asc(subdimensions.ordinal));
    const reconstructed = subRows.map((s) => s.name);
    report(failures, `domain ${legacy.key} subdimensions`, legacy.subdimensions ?? [], reconstructed);
  }

  // ---- Cards ------------------------------------------------------------------
  const cardRows = await db.select().from(cards);
  const legacyCards = EXPERIENCE_CARDS as unknown as Array<{
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
    subdimensions?: string[];
    sampleDestinations?: string[];
    unlockConditions?: { domain: string; minimumPositiveSwipes: number; minimumLoveSwipes: number };
    diagnosticPurpose?: string;
  }>;

  if (cardRows.length !== legacyCards.length) {
    failures.push('card count');
    console.error(`MISMATCH: card count — legacy ${legacyCards.length}, new ${cardRows.length}`);
  }

  for (const legacy of legacyCards) {
    const row = cardRows.find((r) => r.id === legacy.id);
    if (!row) {
      failures.push(`card missing: ${legacy.id}`);
      console.error(`MISSING card: ${legacy.id}`);
      continue;
    }
    report(failures, `card ${legacy.id} short`, legacy.short, row.short);
    report(failures, `card ${legacy.id} title`, legacy.title, row.title);
    report(failures, `card ${legacy.id} description`, legacy.description, row.description);
    report(failures, `card ${legacy.id} category`, legacy.category, row.category);
    report(failures, `card ${legacy.id} tags`, legacy.tags ?? [], row.tags);
    report(failures, `card ${legacy.id} imagePrompt`, legacy.imagePrompt ?? null, row.imagePrompt);
    report(failures, `card ${legacy.id} preferenceSignals`, legacy.preferenceSignals ?? {}, row.preferenceSignals);
    report(failures, `card ${legacy.id} dimensionSignals`, legacy.dimensionSignals ?? {}, row.dimensionSignals);
    report(failures, `card ${legacy.id} stage`, legacy.stage ?? 'broad', row.stage);
    report(failures, `card ${legacy.id} domainKey`, legacy.domain ?? null, row.domainKey);
    report(failures, `card ${legacy.id} cardSubdimensions`, legacy.subdimensions ?? null, row.cardSubdimensions);
    report(failures, `card ${legacy.id} sampleDestinations`, legacy.sampleDestinations ?? null, row.sampleDestinations);
    report(
      failures,
      `card ${legacy.id} unlockMinPositive`,
      legacy.unlockConditions?.minimumPositiveSwipes ?? null,
      row.unlockMinPositive,
    );
    report(
      failures,
      `card ${legacy.id} unlockMinLove`,
      legacy.unlockConditions?.minimumLoveSwipes ?? null,
      row.unlockMinLove,
    );
    report(failures, `card ${legacy.id} diagnosticPurpose`, legacy.diagnosticPurpose ?? null, row.diagnosticPurpose);
  }

  // ---- Dimensions -----------------------------------------------------------
  const dimensionRows = await db.select().from(dimensions);
  const legacyDimensions = DIMENSIONS as Array<{
    id: string;
    label: string;
    poleA: string;
    poleB: string;
    keyA: string;
    keyB: string;
    summaryA: string;
    summaryB: string;
    question: string;
  }>;

  if (dimensionRows.length !== legacyDimensions.length) {
    failures.push('dimension count');
    console.error(`MISMATCH: dimension count — legacy ${legacyDimensions.length}, new ${dimensionRows.length}`);
  }

  for (const legacy of legacyDimensions) {
    const row = dimensionRows.find((r) => r.id === legacy.id);
    if (!row) {
      failures.push(`dimension missing: ${legacy.id}`);
      console.error(`MISSING dimension: ${legacy.id}`);
      continue;
    }
    report(failures, `dimension ${legacy.id}`, legacy, {
      id: row.id,
      label: row.label,
      poleA: row.poleA,
      poleB: row.poleB,
      keyA: row.keyA,
      keyB: row.keyB,
      summaryA: row.summaryA,
      summaryB: row.summaryB,
      question: row.question,
    });
  }

  // ---- Tensions ---------------------------------------------------------------
  const tensionRows = await db.select().from(tensions);
  const legacyTensions = TENSION_LIBRARY as Array<{
    id: string;
    title: string;
    insightText: string;
    recommendationImplication?: string;
    relatedDimensions?: string[];
    signalA: { label: string; type: string; keys: string[]; min: number };
    signalB: { label: string; type: string; keys: string[]; min: number };
  }>;

  if (tensionRows.length !== legacyTensions.length) {
    failures.push('tension count');
    console.error(`MISMATCH: tension count — legacy ${legacyTensions.length}, new ${tensionRows.length}`);
  }

  for (const legacy of legacyTensions) {
    const row = tensionRows.find((r) => r.id === legacy.id);
    if (!row) {
      failures.push(`tension missing: ${legacy.id}`);
      console.error(`MISSING tension: ${legacy.id}`);
      continue;
    }
    report(failures, `tension ${legacy.id} title`, legacy.title, row.title);
    report(failures, `tension ${legacy.id} insightText`, legacy.insightText, row.insightText);
    report(
      failures,
      `tension ${legacy.id} recommendationImplication`,
      legacy.recommendationImplication ?? null,
      row.recommendationImplication,
    );
    report(failures, `tension ${legacy.id} relatedDimensions`, legacy.relatedDimensions ?? [], row.relatedDimensionIds);
    report(failures, `tension ${legacy.id} signalA`, legacy.signalA, row.signalA);
    report(failures, `tension ${legacy.id} signalB`, legacy.signalB, row.signalB);
  }

  console.log(
    `Checked ${legacyDomainEntries.length} domains, ${legacyCards.length} cards, ${legacyDimensions.length} dimensions, ${legacyTensions.length} tensions.`,
  );
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.length} mismatches found.`);
    process.exit(1);
  }
  console.log('PASSED: all migrated content is field-for-field identical to the legacy app.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
