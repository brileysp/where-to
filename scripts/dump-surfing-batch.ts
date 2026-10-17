// Dumps the latest surfing v5 generation for each place id (a hand-edit copy wins when it is newer), with the live text for comparison.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/dump-surfing-batch.ts out.json id1,id2,...
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const ids = process.argv[3].split(',');
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations } = await import('../src/lib/db/schema');
  const { inArray, desc, and, eq } = await import('drizzle-orm');
  const q = await import('../src/lib/db/queries/interest-pages');
  const page = await q.getInterestPageData('surfing');
  const info = new Map(page!.places.map((p) => [p.id, p]));
  const rows = await db.select().from(contentGenerations).where(and(inArray(contentGenerations.placeId, ids), eq(contentGenerations.interestKey, 'surfing'))).orderBy(desc(contentGenerations.createdAt));
  const out = [];
  for (const id of ids) {
    const mine = rows.filter((r) => r.placeId === id && r.promptVersion.startsWith('surfing/v5'));
    const latest = mine[0];
    if (!latest) { out.push({ placeId: id, name: info.get(id)?.name ?? id, missing: true }); continue; }
    const orig = mine.filter((r) => !r.promptVersion.includes('hand edit')).slice(-1)[0] ?? latest;
    const p = info.get(id);
    out.push({ id: latest.id, origId: orig.id, placeId: id, name: p?.name ?? id, edited: latest.promptVersion.includes('hand edit'), status: latest.validationStatus, issues: latest.validationErrors, out: latest.parsedOutput, rawScores: (() => { try { const j = JSON.parse((orig.rawResponse as any).candidates[0].content.parts[0].text); return 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').map((m) => j['score_' + m]); } catch { return null; } })(), origIssues: orig.validationErrors, old: { status: p?.status, monthly: p?.monthly, overview: p?.overview, naReason: p?.naReason, facts: p?.facts } });
  }
  writeFileSync(process.argv[2], JSON.stringify(out));
  console.log(out.length, 'places;', out.filter((o: any) => o.missing).length, 'missing');
  process.exit(0);
})();
