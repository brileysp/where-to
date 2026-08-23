import { asc } from 'drizzle-orm';
import { db } from '../client';
import { cards, domains, subdimensions, dimensions, tensions } from '../schema';
import type { DimensionDef, DnaCard, DomainDef, TensionDef } from '@/lib/dna/types';

export async function getAllDnaCards(): Promise<DnaCard[]> {
  const rows = await db.select().from(cards);
  return rows.map((row) => ({
    id: row.id,
    short: row.short,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags,
    preferenceSignals: row.preferenceSignals,
    dimensionSignals: row.dimensionSignals,
    stage: row.stage,
    domain: row.domainKey,
    niche: row.niche,
    subdimensions: row.cardSubdimensions,
    sampleDestinations: row.sampleDestinations,
    unlockMinPositive: row.unlockMinPositive,
    unlockMinLove: row.unlockMinLove,
    diagnosticPurpose: row.diagnosticPurpose,
  }));
}

export async function getAllDomainDefs(): Promise<DomainDef[]> {
  const domainRows = await db.select().from(domains);
  const subdimRows = await db.select().from(subdimensions).orderBy(asc(subdimensions.ordinal));

  const subdimsByDomain = new Map<string, string[]>();
  subdimRows.forEach((s) => {
    const list = subdimsByDomain.get(s.domainKey) || [];
    list.push(s.name);
    subdimsByDomain.set(s.domainKey, list);
  });

  return domainRows.map((row) => ({
    key: row.key,
    label: row.label,
    emoji: row.emoji,
    matchCategories: row.matchCategories,
    matchTags: row.matchTags,
    hasDeepCards: row.hasDeepCards,
    subdimensions: subdimsByDomain.get(row.key) || [],
    unlockMinPositive: row.unlockMinPositive,
    unlockMinLove: row.unlockMinLove,
    transitionTitle: row.transitionTitle,
    transitionBody: row.transitionBody,
  }));
}

export async function getAllDimensionDefs(): Promise<DimensionDef[]> {
  const rows = await db.select().from(dimensions);
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    poleA: row.poleA,
    poleB: row.poleB,
    keyA: row.keyA,
    keyB: row.keyB,
    summaryA: row.summaryA,
    summaryB: row.summaryB,
    question: row.question,
  }));
}

export async function getAllTensionDefs(): Promise<TensionDef[]> {
  const rows = await db.select().from(tensions);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    insightText: row.insightText,
    recommendationImplication: row.recommendationImplication,
    relatedDimensions: row.relatedDimensionIds,
    signalA: row.signalA,
    signalB: row.signalB,
  }));
}
