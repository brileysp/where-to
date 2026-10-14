// Fact-check workflow for staged Gemini text. See docs/fact-check-process.md.
//   npx tsx scripts/fact-check.ts list --generation-id=<id> [--out=file.json]   lists the claims still to check, writes a skeleton to fill in
//   npx tsx scripts/fact-check.ts set --place=<id> --interest=<key> --file=verdicts.json [--by=Claude]   records verdicts
//   npx tsx scripts/fact-check.ts status --interest=<key>                       latest staged text per place: claims checked / total
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const cmd = process.argv[2];
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations, places } = await import('../src/lib/db/schema');
  const { eq, and, desc } = await import('drizzle-orm');
  const { syncAndGate, recordVerdicts } = await import('../src/lib/gemini/fact-check');
  const { claimKinds } = await import('../src/lib/gemini/claims');
  if (cmd === 'list') {
    const id = arg('generation-id'); if (!id) throw new Error('--generation-id is required');
    const [gen] = await db.select().from(contentGenerations).where(eq(contentGenerations.id, id));
    const [place] = await db.select().from(places).where(eq(places.id, gen.placeId));
    const gate = await syncAndGate(gen.placeId, gen.interestKey, gen.parsedOutput as never, place.name);
    console.log(`${place.name} (${gen.interestKey}): ${gate.resolved} of ${gate.total} claims checked, ${gate.unresolved.length} to do.`);
    const skeleton: Record<string, unknown> = {};
    for (const u of gate.unresolved) {
      const { entities } = claimKinds(u.sentence, place.name);
      console.log(`\n[${u.hash}] ${u.where.join(',')}  (${u.kinds.join(', ')})${u.verdict === 'wrong' ? '  ** marked WRONG earlier **' : ''}\n  ${u.sentence}${entities.length ? `\n  names: ${entities.join(' | ')}` : ''}`);
      skeleton[u.hash] = { sentence: u.sentence, entities, verdict: '', sourceUrl: '', note: '' };
    }
    const out = arg('out'); if (out) { writeFileSync(out, JSON.stringify({ placeId: gen.placeId, interestKey: gen.interestKey, verdicts: skeleton }, null, 1)); console.log(`\nSkeleton written to ${out}`); }
  } else if (cmd === 'set') {
    const placeId = arg('place'), interest = arg('interest'), file = arg('file'); if (!placeId || !interest || !file) throw new Error('--place, --interest and --file are required');
    const raw = JSON.parse(readFileSync(file, 'utf8')); const verdicts = (raw.verdicts ?? raw) as Record<string, { verdict: never; sourceUrl?: string; note?: string }>;
    const filled = Object.fromEntries(Object.entries(verdicts).filter(([, v]) => v.verdict));
    const problems = await recordVerdicts(placeId, interest, filled, arg('by') ?? 'Claude');
    console.log(`recorded ${Object.keys(filled).length - problems.length} verdict(s)`); for (const p of problems) console.log('  PROBLEM:', p);
  } else if (cmd === 'status') {
    const interest = arg('interest'); if (!interest) throw new Error('--interest is required');
    const rows = await db.select().from(contentGenerations).where(and(eq(contentGenerations.interestKey, interest))).orderBy(desc(contentGenerations.createdAt));
    const seen = new Set<string>(); let tot = 0, done = 0, n = 0;
    for (const g of rows) {
      if (seen.has(g.placeId) || g.appliedAt) continue; seen.add(g.placeId);
      const [place] = await db.select().from(places).where(eq(places.id, g.placeId)); if (!place) continue;
      const gate = await syncAndGate(g.placeId, interest, g.parsedOutput as never, place.name);
      if (gate.total === 0) continue; n++; tot += gate.total; done += gate.resolved;
      console.log(`${place.name.padEnd(34)} ${String(gate.resolved).padStart(3)} / ${String(gate.total).padStart(3)} checked`);
    }
    console.log(`\n${n} staged place(s): ${done} of ${tot} claims checked.`);
  } else console.log('Usage: list | set | status (see the header of this file)');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
