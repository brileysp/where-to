import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { interestMeta, interestStaleChecks, interestStaleFactors, interestStaleOptOuts, STALE_SITE_KEY } from '@/lib/db/schema';
import { roundProgress, type RoundProgress, type StaleCheckRow, type StaleFactorRow } from '@/lib/admin/stale-checks';

const toCheck = (c: typeof interestStaleChecks.$inferSelect): StaleCheckRow => ({ result: c.result, note: c.note, checkedBy: c.checkedBy, checkedAt: c.checkedAt.toISOString(), todoId: c.todoId });
type FactorRow = typeof interestStaleFactors.$inferSelect;
const toRow = (f: FactorRow, last: StaleCheckRow | null, thisRound: StaleCheckRow | null, extra: Partial<StaleFactorRow> = {}): StaleFactorRow => ({ id: f.id, interestKey: f.interestKey, category: f.category, statement: f.statement, howToCheck: f.howToCheck, checker: f.checker, checkEvery: f.checkEvery, sortOrder: f.sortOrder, active: f.active, last, thisRound, ...extra });

/** The reasons that apply to every interest (held once, at site level), retired ones included. */
export async function getSiteFactors(): Promise<FactorRow[]> {
  return db.select().from(interestStaleFactors).where(eq(interestStaleFactors.interestKey, STALE_SITE_KEY)).orderBy(asc(interestStaleFactors.sortOrder), asc(interestStaleFactors.createdAt));
}

/**
 * The reasons for one interest: its own, then the site-wide ones (flagged inherited, with this interest's opt-out). Each has its latest result (for a site-wide reason, the latest one
 * recorded for THIS interest) and, when `todoId` is given, the result recorded for that review round. Retired reasons are included, flagged.
 */
export async function getStaleFactors(interestKey: string, todoId: string | null = null): Promise<StaleFactorRow[]> {
  const own = await db.select().from(interestStaleFactors).where(eq(interestStaleFactors.interestKey, interestKey)).orderBy(asc(interestStaleFactors.sortOrder), asc(interestStaleFactors.createdAt));
  const site = interestKey === STALE_SITE_KEY ? [] : await getSiteFactors();
  const all = [...own, ...site];
  if (!all.length) return [];
  const [checks, opts] = await Promise.all([
    db.select().from(interestStaleChecks).where(inArray(interestStaleChecks.factorId, all.map((f) => f.id))).orderBy(desc(interestStaleChecks.checkedAt)),
    site.length ? db.select().from(interestStaleOptOuts).where(eq(interestStaleOptOuts.interestKey, interestKey)) : Promise.resolve([]),
  ]);
  const siteIds = new Set(site.map((f) => f.id));
  const lastBy = new Map<string, StaleCheckRow>(); const roundBy = new Map<string, StaleCheckRow>();
  for (const c of checks) {
    if (siteIds.has(c.factorId) && c.interestKey !== interestKey) continue; // a site-wide reason's results belong to the interest they were recorded for
    if (!lastBy.has(c.factorId)) lastBy.set(c.factorId, toCheck(c));
    if (todoId && c.todoId === todoId && !roundBy.has(c.factorId)) roundBy.set(c.factorId, toCheck(c));
  }
  const optBy = new Map(opts.map((o) => [o.factorId, o.note]));
  return [
    ...own.map((f) => toRow(f, lastBy.get(f.id) ?? null, roundBy.get(f.id) ?? null)),
    ...site.map((f) => toRow(f, lastBy.get(f.id) ?? null, roundBy.get(f.id) ?? null, { inherited: true, optedOut: optBy.has(f.id), optOutNote: optBy.get(f.id) ?? '' })),
  ];
}

/** Every given interest's reasons (own plus site-wide) with their latest results, for the Interests grid: a handful of queries for all, not one set per interest. */
export async function getStaleFactorsByInterest(interestKeys: string[]): Promise<Record<string, StaleFactorRow[]>> {
  const factors = await db.select().from(interestStaleFactors).where(eq(interestStaleFactors.active, true));
  if (!factors.length) return {};
  const [checks, opts] = await Promise.all([db.select().from(interestStaleChecks).orderBy(desc(interestStaleChecks.checkedAt)), db.select().from(interestStaleOptOuts)]);
  const siteIds = new Set(factors.filter((f) => f.interestKey === STALE_SITE_KEY).map((f) => f.id));
  const lastOwn = new Map<string, StaleCheckRow>(); const lastSite = new Map<string, StaleCheckRow>(); // site: key `${factorId}|${interestKey}`
  for (const c of checks) {
    if (siteIds.has(c.factorId)) { const k = `${c.factorId}|${c.interestKey}`; if (!lastSite.has(k)) lastSite.set(k, toCheck(c)); }
    else if (!lastOwn.has(c.factorId)) lastOwn.set(c.factorId, toCheck(c));
  }
  const optOut = new Set(opts.map((o) => `${o.factorId}|${o.interestKey}`));
  const out: Record<string, StaleFactorRow[]> = {};
  for (const key of interestKeys) {
    out[key] = [
      ...factors.filter((f) => f.interestKey === key).map((f) => toRow(f, lastOwn.get(f.id) ?? null, null)),
      ...factors.filter((f) => siteIds.has(f.id)).map((f) => toRow(f, lastSite.get(`${f.id}|${key}`) ?? null, null, { inherited: true, optedOut: optOut.has(`${f.id}|${key}`) })),
    ];
  }
  return out;
}

/** How many of the reasons asked in this interest's review round already have a result: the number the gate on the review to-do looks at. */
export async function getRoundProgress(interestKey: string, todoId: string): Promise<RoundProgress> {
  const [factors, [meta]] = await Promise.all([getStaleFactors(interestKey, todoId), db.select({ evergreen: interestMeta.evergreen }).from(interestMeta).where(eq(interestMeta.key, interestKey))]);
  return roundProgress(factors, meta?.evergreen ?? null);
}
