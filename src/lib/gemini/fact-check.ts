import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { contentFactChecks, type FactCheckVerdict } from '@/lib/db/schema';
import { extractClaims, type Claim } from './claims';
import type { GenerationOutput } from './schema';
import { isNotApplicable } from './validate';

/**
 * The fact-check gate. A generation cannot be applied while any high-risk sentence in it (see claims.ts) lacks a verdict of
 * 'verified' (checked against a source) or 'owner_accepted'. Text from an N/A draft is exempt: it holds no claims about walking.
 * Process and source rules: docs/fact-check-process.md.
 */

export interface GateResult {
  ok: boolean;
  total: number; // high-risk sentences in the text
  resolved: number;
  unresolved: Array<{ hash: string; sentence: string; where: string[]; kinds: string[]; verdict: FactCheckVerdict; note: string }>;
}

const RESOLVED = new Set<FactCheckVerdict>(['verified', 'owner_accepted']);

/** Makes sure every high-risk sentence has a row (unchecked when new) and returns the gate result. */
export async function syncAndGate(placeId: string, interestKey: string, output: GenerationOutput, placeName: string): Promise<GateResult> {
  if (isNotApplicable(output)) return { ok: true, total: 0, resolved: 0, unresolved: [] };
  const claims = extractClaims(output, placeName);
  return syncClaims(placeId, interestKey, claims);
}

export async function syncClaims(placeId: string, interestKey: string, claims: Claim[]): Promise<GateResult> {
  const rows = await db.select().from(contentFactChecks).where(and(eq(contentFactChecks.placeId, placeId), eq(contentFactChecks.interestKey, interestKey)));
  const byHash = new Map(rows.map((r) => [r.sentenceHash, r]));
  const missing = claims.filter((c) => !byHash.has(c.hash));
  if (missing.length) {
    await db.insert(contentFactChecks).values(missing.map((c) => ({ placeId, interestKey, sentenceHash: c.hash, sentence: c.sentence, kinds: c.kinds }))).onConflictDoNothing();
    for (const c of missing) byHash.set(c.hash, { verdict: 'unchecked', note: '' } as never);
  }
  const unresolved: GateResult['unresolved'] = [];
  for (const c of claims) {
    const r = byHash.get(c.hash)!;
    if (!RESOLVED.has(r.verdict)) unresolved.push({ hash: c.hash, sentence: c.sentence, where: c.where, kinds: c.kinds, verdict: r.verdict, note: r.note });
  }
  return { ok: unresolved.length === 0, total: claims.length, resolved: claims.length - unresolved.length, unresolved };
}

export interface VerdictInput { verdict: FactCheckVerdict; sourceUrl?: string; note?: string }

/** Records verdicts. 'verified' needs a source link and a note saying what the source says. */
export async function recordVerdicts(placeId: string, interestKey: string, verdicts: Record<string, VerdictInput>, checkedBy: string): Promise<string[]> {
  const problems: string[] = [];
  for (const [hash, v] of Object.entries(verdicts)) {
    if (v.verdict === 'verified' && !/^https?:\/\//.test(v.sourceUrl ?? '')) { problems.push(`${hash}: verified needs a source URL`); continue; }
    if (v.verdict === 'verified' && (v.note ?? '').trim().length < 8) { problems.push(`${hash}: verified needs a note saying what the source says`); continue; }
    const res = await db.update(contentFactChecks).set({ verdict: v.verdict, sourceUrl: v.sourceUrl ?? '', note: v.note ?? '', checkedBy, checkedAt: new Date() })
      .where(and(eq(contentFactChecks.placeId, placeId), eq(contentFactChecks.interestKey, interestKey), eq(contentFactChecks.sentenceHash, hash))).returning();
    if (res.length === 0) problems.push(`${hash}: no such sentence recorded for ${placeId}/${interestKey}`);
  }
  return problems;
}
