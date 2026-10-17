import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Owner-requested fixes to staged surfing generations (13 Oct 2026). Reads { placeId: { generationId, overview?, months?: {"1".."12": text}, scores?: number[12] } },
// copies the staged generation, applies the edits, validates the copy like any generation and stages it as a new generation.
// Nothing is applied to places. Usage: npx tsx scripts/surfing-hand-edits.ts scripts/data/surfing-batch1-edits-2026-10-13.json
// Set INTEREST=hiking to stage fixes for another interest (default surfing).
const INTEREST = process.env.INTEREST ?? 'surfing';
type Edit = { generationId: string; overview?: string; months?: Record<string, string>; scores?: number[]; extras?: Record<string, number>; sources?: unknown[] };
(async () => {
  const edits = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Record<string, Edit>;
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations, contentGenerationBatches } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const { validateContent, overallStatus } = await import('../src/lib/gemini/validate');
  const { usesMonthsNotSeasons } = await import('../src/lib/gemini/hemisphere');
  const { places } = await import('../src/lib/db/schema');
  const [batch] = await db.insert(contentGenerationBatches).values({ interestKey: INTEREST, kind: 'author', rolloutPhase: 0, placeCount: Object.keys(edits).length, totalCostUsd: 0 } as never).returning({ id: contentGenerationBatches.id });
  const out: Array<{ placeId: string; id: string; status: string }> = [];
  for (const [placeId, e] of Object.entries(edits)) {
    const [base] = await db.select().from(contentGenerations).where(eq(contentGenerations.id, e.generationId));
    if (!base) { console.log('NO BASE', placeId); continue; }
    const b = base.parsedOutput as { overview: string; monthly: Array<{ score: number; text: string }>; extras?: unknown; sources: unknown[]; confidence: string; flags: string[] };
    const monthly = b.monthly.map((m, i) => ({ score: e.scores ? e.scores[i] : m.score, text: e.months?.[String(i + 1)] ?? m.text }));
    const parsed = { ...b, overview: e.overview ?? b.overview, monthly, ...(e.sources ? { sources: e.sources } : {}), ...(e.extras ? { extras: { ...(b.extras as object), ...e.extras } } : {}) };
    const [pl] = await db.select({ cc: places.countryCode }).from(places).where(eq(places.id, placeId));
    const { placeInterestFacts } = await import('../src/lib/db/schema');
    const [pf] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, INTEREST)));
    const crowding = INTEREST === 'hiking' ? (((pf?.facts ?? {}) as { crowdIndicators?: string[] }).crowdIndicators ?? []).length : undefined;
    const issues = validateContent(parsed as never, INTEREST, placeId, { monthsNotSeasons: INTEREST === 'hiking' && usesMonthsNotSeasons(pl?.cc), crowding });
    issues.push({ layer: 'content', severity: 'warning', message: `Hand-edited copy of generation ${base.id}, made 14 Oct 2026 at the owner's request.` });
    const status = overallStatus(issues);
    const [row] = await db.insert(contentGenerations).values({
      batchId: batch.id, placeId, interestKey: INTEREST, kind: 'author', promptVersion: `${base.promptVersion.replace(/ \(hand edit.*$/, '')} (hand edit 2026-10-14)`, promptHash: base.promptHash, inputContextHash: base.inputContextHash,
      model: 'Claude (owner-requested edit)', temperature: 0, rawResponse: { handEditOf: base.id } as never, parsedOutput: parsed as never, validationStatus: status, validationErrors: issues as never, tokensIn: 0, tokensOut: 0, costUsd: 0,
    } as never).returning({ id: contentGenerations.id });
    out.push({ placeId, id: row.id, status });
    const shown = issues.filter((i) => i.severity === 'reject' || !/share duplicate|Hand-edited/.test(i.message));
    console.log(`${placeId}: ${status} | new id ${row.id}${shown.length ? '\n   ' + shown.map((i) => `${i.severity}: ${i.message.slice(0, 160)}`).join('\n   ') : ''}`);
  }
  console.log(JSON.stringify(out));
  process.exit(0);
})();
