// 1 Nov 2026: saves approved family-authoring texts and scores into the app (owner: "museums and architecture are good now, lock it in").
// For each applicable cell in the results file: sliderOverview (overview), sliderMonthlyWeather (12 month texts built from the blurbs; one blurb for the year is repeated),
// the month scores (proposed scores from scripts/score-proposals.ts, refitted as a curve; base score = peak), and the 'gemini' stamps. Every cell also gets a content_generations
// record (the Gemini output, the scores and what they cost) under one content_generation_batches row per interest. No sentence-by-sentence fact-check gate: these are low-stakes
// interests (Stakes 2 and 3), checked by the automatic checks and the owner's reading. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-family-text.ts --results=r.json --proposals=p.json --interests=museumsArt,architecture [--exclude=museumsArt:rajasthan-golden-triangle] [--text-edits=edits.json] [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const apply = process.argv.includes('--apply');
  const interests = new Set((arg('interests') ?? '').split(',').filter(Boolean));
  const exclude = new Set((arg('exclude') ?? '').split(',').filter(Boolean).map((x) => x.replace(':', '|')));
  const edits = arg('text-edits') ? (JSON.parse(readFileSync(arg('text-edits')!, 'utf8')) as Record<string, { overview?: string }>) : {};
  const results = JSON.parse(readFileSync(arg('results')!, 'utf8')) as any[];
  const proposals = new Map((JSON.parse(readFileSync(arg('proposals')!, 'utf8')).cells as any[]).map((c) => [`${c.k}|${c.id}`, c]));
  const { db } = await import('../src/lib/db/client');
  const { places, contentGenerations, contentGenerationBatches } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply-actor');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const { curveValue, parseSliderCurve } = await import('../src/lib/scoring/curve');
  const { sha256, hashObject } = await import('../src/lib/gemini/hashing');
  const root = join(__dirname, '..');
  const promptHash = sha256(['prompts/family-v1.md', 'prompts/_shared/authoring-core.md', 'prompts/_shared/authoring-scores.md'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n'));
  const todo = results.filter((r) => interests.has(r.k) && r.gemini?.applicable && proposals.has(`${r.k}|${r.id}`) && !exclude.has(`${r.k}|${r.id}`));
  console.log(`${todo.length} cells to save of ${results.filter((r) => interests.has(r.k)).length} in the results (${exclude.size} excluded, rest N/A or without scores)`);
  const monthTexts = (g: any): string[] => { const out: string[] = new Array(12).fill(''); for (const b of g.blurbs) for (const m of b.months) if (m >= 1 && m <= 12) out[m - 1] = b.text; return out.map((t, i) => t || g.blurbs[0]?.text || ''); };
  let badFit = 0, saved = 0, problems = 0;
  const batchIds = new Map<string, string>();
  for (const k of interests) {
    const mine = todo.filter((r) => r.k === k); if (!mine.length) continue;
    if (apply) {
      const [b] = await db.insert(contentGenerationBatches).values({ interestKey: k, kind: 'author', rolloutPhase: 3, placeCount: mine.length, totalCostUsd: mine.reduce((a, r) => a + r.cost, 0), promptVersion: 'family/v1 + authoring-core/v1 + authoring-scores/v1', model: mine[0].model, thinkingLevel: 'low', tokensIn: mine.reduce((a, r) => a + r.tokensIn, 0), tokensOut: mine.reduce((a, r) => a + r.tokensOut, 0), finishedAt: new Date() }).returning();
      batchIds.set(k, b.id);
    }
  }
  for (const r of todo) {
    const p = proposals.get(`${r.k}|${r.id}`);
    const g = r.gemini; const overview = edits[`${r.k}|${r.id}`]?.overview ?? g.overview;
    const months = monthTexts(g);
    const prop: number[] = p.proposed;
    const { curve } = fitMonthlyToCurve(prop, { maxSteepness: 4, errorTolerance: 0.15 });
    const back = Array.from({ length: 12 }, (_, i) => curveValue(i + 1, parseSliderCurve(curve as never)));
    const maxErr = Math.max(...back.map((v, i) => Math.abs(v - prop[i])));
    if (maxErr > 0.3) { badFit++; console.log(`  curve fit off by ${maxErr.toFixed(2)}: ${r.k} ${r.id}`); }
    if (!apply) continue;
    const [place] = await db.select().from(places).where(eq(places.id, r.id));
    const [gen] = await db.insert(contentGenerations).values({
      batchId: batchIds.get(r.k)!, placeId: r.id, interestKey: r.k, kind: 'author', promptVersion: 'family/v1', promptHash, inputContextHash: hashObject({ place: r.name, interest: r.k }), model: r.model, temperature: 0.2,
      rawResponse: { note: 'Gemini output as collected by the family runner; month scores added in a second call', scores: { gemini: p.gemini, proposed: prop, ours: p.ours, class: p.cls } } as never,
      parsedOutput: g as never, validationStatus: 'applied', validationErrors: [], tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsd: r.cost, appliedAt: new Date(),
    }).returning();
    const stamp = { origin: 'gemini' as const, originGenerationId: gen.id, lastEditedBy: 'gemini' as const, lastEditorName: r.model, lastEditedAt: new Date().toISOString(), lastChange: 'Gemini family authoring' };
    const loaded = place.updatedAt.toISOString();
    const patches = [
      { entityType: 'destination', entityId: r.id, field: 'sliderCurves', value: { ...(place.sliderCurves as Record<string, unknown>), [r.k]: curve }, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: r.id, field: 'baseScores', value: { ...(place.baseScores as Record<string, number>), [r.k]: Math.max(...prop) }, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: r.id, field: 'sliderOverview', value: { ...(place.sliderOverview as Record<string, string>), [r.k]: overview }, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: r.id, field: 'sliderMonthlyWeather', value: { ...(place.sliderMonthlyWeather as Record<string, string[]>), [r.k]: months }, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: r.id, field: 'sliderOverviewMeta', value: { ...(place.sliderOverviewMeta as Record<string, unknown>), [r.k]: stamp }, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: r.id, field: 'sliderMonthlyWeatherMeta', value: { ...(place.sliderMonthlyWeatherMeta as Record<string, unknown>), [r.k]: new Array(12).fill(stamp) }, loadedUpdatedAt: loaded },
    ];
    const ov = (place.scoreOverrides as Record<string, unknown>) ?? {};
    if (ov[r.k]) { const { [r.k]: _x, ...rest } = ov; patches.push({ entityType: 'destination', entityId: r.id, field: 'scoreOverrides', value: rest, loadedUpdatedAt: loaded }); }
    const res = await applyAdminEdits(patches as never, SYSTEM_ACTOR);
    if (res.errors.length || res.conflicts.length) { problems++; console.log('PROBLEM', r.k, r.id, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); } else saved++;
    if (saved % 50 === 0 && saved) console.log(`  ${saved} saved`);
  }
  console.log(`${apply ? 'saved' : 'would save'} ${apply ? saved : todo.length} cells; curve fits off by more than 0.3: ${badFit}; problems: ${problems}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
