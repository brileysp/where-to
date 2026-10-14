import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Stages a flat-score copy of the live whale text for places that use one blurb all year (7 Oct 2026).
// Text is unchanged; only the twelve scores become one value. Apply afterwards with pipeline-apply --generation-id.
const FLAT: Record<string, number> = { buenosaires: 0.6, 'colombian-caribbean': 1.0 };
const HOME_BATCH = '0e674e5f-4ab2-47f4-8038-02834e97981e';
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations } = await import('../src/lib/db/schema');
  const { and, eq, desc } = await import('drizzle-orm');
  const { validateContent, overallStatus } = await import('../src/lib/gemini/validate');
  for (const [placeId, score] of Object.entries(FLAT)) {
    const gens = await db.select().from(contentGenerations).where(and(eq(contentGenerations.placeId, placeId), eq(contentGenerations.interestKey, 'whaleWatching'))).orderBy(desc(contentGenerations.createdAt));
    const src = gens.find((g) => g.appliedAt);
    if (!src) { console.log(placeId, 'no applied generation found'); continue; }
    const out = JSON.parse(JSON.stringify(src.parsedOutput)) as { overview: string; monthly: Array<{ score: number; text: string }> };
    if (new Set(out.monthly.map((m) => m.text.trim().toLowerCase())).size !== 1) { console.log(placeId, 'not a single blurb, skipped'); continue; }
    out.monthly.forEach((m) => (m.score = score));
    const issues = validateContent(out as never, 'whaleWatching', placeId);
    issues.push({ layer: 'content', severity: 'warning', message: `Flat score copy of generation ${src.id}, made 7 Oct 2026: one blurb all year, so one score (${score}). Text unchanged.` });
    const [row] = await db.insert(contentGenerations).values({
      batchId: HOME_BATCH, placeId, interestKey: 'whaleWatching', kind: 'author', promptVersion: `${src.promptVersion} (flat-score copy)`, promptHash: src.promptHash, inputContextHash: src.inputContextHash,
      model: src.model, temperature: 0, rawResponse: { flatCopyOf: src.id } as never, parsedOutput: out as never, validationStatus: overallStatus(issues), validationErrors: issues as never, tokensIn: 0, tokensOut: 0, costUsd: 0,
    }).returning({ id: contentGenerations.id });
    console.log(placeId, row.id, overallStatus(issues));
  }
  process.exit(0);
})();
