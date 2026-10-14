import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Owner-approved whale watching text/score fixes from the 7 Oct 2026 source check (applied 8 Oct 2026).
// Reads { placeId: { overview?, months?: {"1".."12": text}, scores?: number[12], replace?: [[from,to]], na?: reason } } and
// { placeId: { cellKey: value } } facts, builds a hand-edited copy of the live text, validates it like any generation,
// stages it, and with --apply commits it through applyGeneration (the same audited path as the pipeline).
// Usage: npx tsx scripts/whale-source-edits.ts edits.json facts.json [--apply]
type Edit = { overview?: string; months?: Record<string, string>; scores?: number[]; replace?: Array<[string, string]>; na?: string };
(async () => {
  const edits = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Record<string, Edit>;
  const facts = JSON.parse(readFileSync(process.argv[3], 'utf8')) as Record<string, Record<string, string | null>>;
  const doApply = process.argv.includes('--apply');
  const dry = process.argv.includes('--dry');
  const { db } = await import('../src/lib/db/client');
  const { places, contentGenerations, contentGenerationBatches, placeInterestFacts } = await import('../src/lib/db/schema');
  const { and, eq, desc } = await import('drizzle-orm');
  const { validateContent, overallStatus, NOT_APPLICABLE_MARKER } = await import('../src/lib/gemini/validate');
  const { stripEmphasis } = await import('../src/lib/text/emphasis');
  const { applyGeneration } = await import('../src/lib/gemini/apply');
  const batch = dry ? { id: '' } : (await db.insert(contentGenerationBatches).values({ interestKey: 'whaleWatching', kind: 'author', rolloutPhase: 0, placeCount: Object.keys(edits).length, totalCostUsd: 0 } as never).returning({ id: contentGenerationBatches.id }))[0];
  const staged: Array<{ placeId: string; id: string; status: string }> = [];
  for (const [placeId, e] of Object.entries(edits)) {
    const [p] = await db.select().from(places).where(eq(places.id, placeId));
    if (!p) { console.log('UNKNOWN PLACE', placeId); continue; }
    const gens = await db.select().from(contentGenerations).where(and(eq(contentGenerations.placeId, placeId), eq(contentGenerations.interestKey, 'whaleWatching'))).orderBy(desc(contentGenerations.createdAt));
    const base = gens.find((g) => g.appliedAt);
    if (!base) { console.log('no applied generation for', placeId); continue; }
    const baseOut = base.parsedOutput as { overview: string; monthly: Array<{ score: number; text: string }> };
    const liveOv = (p.sliderOverview as Record<string, string>)?.whaleWatching ?? baseOut.overview;
    const liveMo = (p.sliderMonthlyWeather as Record<string, string[]>)?.whaleWatching ?? baseOut.monthly.map((m) => m.text);
    let out: { overview: string; monthly: Array<{ score: number; text: string }>; sources: unknown[]; confidence: string; flags: string[] };
    if (e.na) {
      out = { overview: `${NOT_APPLICABLE_MARKER} ${e.na}`, monthly: Array.from({ length: 12 }, () => ({ score: 0, text: 'n/a' })), sources: [], confidence: 'high', flags: [] };
    } else {
      let overview = stripEmphasis(liveOv);
      const texts = liveMo.map((t) => stripEmphasis(t));
      for (const [from, to] of e.replace ?? []) { overview = overview.split(from).join(to); for (let i = 0; i < 12; i++) texts[i] = texts[i].split(from).join(to); }
      if (e.overview) overview = e.overview;
      for (const [k, t] of Object.entries(e.months ?? {})) texts[Number(k) - 1] = t;
      out = { overview, monthly: texts.map((t, i) => ({ score: e.scores ? e.scores[i] : baseOut.monthly[i].score, text: t })), sources: [], confidence: 'medium', flags: [] };
    }
    const issues = validateContent(out as never, 'whaleWatching', placeId);
    issues.push({ layer: 'content', severity: 'warning', message: `Hand-edited copy of generation ${base.id}, made 8 Oct 2026 after the whale source check (owner-approved).` });
    const status = overallStatus(issues);
    const [row] = dry ? [{ id: 'dry' }] : await db.insert(contentGenerations).values({
      batchId: batch.id, placeId, interestKey: 'whaleWatching', kind: 'author', promptVersion: 'whaleWatching (hand edit 2026-10-08)', promptHash: base.promptHash, inputContextHash: base.inputContextHash,
      model: 'Claude (source check edit)', temperature: 0, rawResponse: { handEditOf: base.id } as never, parsedOutput: out as never, validationStatus: status, validationErrors: issues as never, tokensIn: 0, tokensOut: 0, costUsd: 0,
    }).returning({ id: contentGenerations.id });
    staged.push({ placeId, id: row.id, status });
    const bad = issues.filter((i) => i.severity === 'reject' || /characters|guarantee|severe|severity|lacks|premier/i.test(i.message));
    console.log(`${placeId}: ${status} | peak ${Math.max(...out.monthly.map((m) => m.score))}${bad.length ? ' | ' + bad.map((i) => `${i.severity}: ${i.message.slice(0, 110)}`).join(' ; ') : ''}`);
  }
  if (doApply) {
    for (const s of staged.filter((x) => x.status === 'valid')) {
      const r = await applyGeneration(s.id);
      console.log('APPLY', s.placeId, r.outcome, r.detail.slice(0, 90));
    }
  }
  // facts (species cells); an N/A place has no facts row
  if (doApply) {
    for (const [placeId, cells] of Object.entries(facts)) {
      if (edits[placeId]?.na) { await db.delete(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'whaleWatching'))); console.log('facts cleared', placeId); continue; }
      const [row] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'whaleWatching')));
      const f = { ...((row?.facts as Record<string, unknown>) ?? {}) };
      for (const [k, v] of Object.entries(cells)) { if (v === null) delete f[k]; else f[k] = v; }
      await db.insert(placeInterestFacts).values({ placeId, interestKey: 'whaleWatching', facts: f as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: f as never, updatedAt: new Date() } });
      console.log('facts', placeId, Object.keys(cells).join(','));
    }
  }
  console.log('staged', staged.length, 'valid', staged.filter((s) => s.status === 'valid').length);
  process.exit(0);
})();
