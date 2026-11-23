// 10 Nov 2026: offline check of "What else matters" matching on the real traveler-needs data. Never writes anything.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/shadow-care-match.ts
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { getTravelFacts } = await import('../src/lib/db/queries/travel-needs'); const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { careMatch } = await import('../src/lib/onboarding/care-match');
  const facts = await getTravelFacts(); const names = new Map(((await getPrimaryPlaceRows()) as any[]).map((r) => [r.id, r.name as string]));
  const P: Record<string, Record<string, { o: string[]; firm: boolean }>> = {
    'Family with a toddler and an 8-year-old (must)': { kids: { o: ['u5', 'k'], firm: true } },
    'Family with a toddler and an 8-year-old (nice to have)': { kids: { o: ['u5', 'k'], firm: false } },
    'Halal (must)': { food: { o: ['halal'], firm: true } },
    'Vegan and gluten-free (nice to have)': { food: { o: ['vegan', 'gf'], firm: false } },
    'Speaks Spanish only (must)': { lang: { o: ['es'], firm: true } },
    'Needs English to work (must)': { lang: { o: ['en'], firm: true } },
    'Wheelchair or walker (must)': { access: { o: ['chair'], firm: true } },
    'Few steps (must)': { access: { o: ['steps'], firm: true } },
    'Likes road trips': { how: { o: ['road'], firm: false } },
    'Likes cruises': { how: { o: ['cruise'], firm: false } },
  };
  const n = (id: string) => names.get(id) ?? id; const total = Object.keys(facts).length;
  for (const [label, care] of Object.entries(P)) {
    const r = careMatch({ care, facts }); const dropped = Object.entries(r.factors).sort((a, b) => a[1] - b[1]); const matches = Object.entries(r.notes).filter(([, v]) => v._care.matches.length && v._care.factor >= 0.999).length;
    console.log(`\n${label}: ${Object.keys(r.hidden).length} set aside, ${dropped.length} lowered (${dropped.filter(([, f]) => f < 0.9).length} by more than 10%), ${matches} full matches, of ${total} places`);
    if (Object.keys(r.hidden).length) console.log('  set aside: ' + Object.keys(r.hidden).slice(0, 14).map((id) => n(id)).join(', ') + (Object.keys(r.hidden).length > 14 ? ', ...' : ''));
    else console.log('  lowest: ' + dropped.slice(0, 10).map(([id, f]) => `${n(id)} ${(f * 100).toFixed(0)}%`).join(', '));
  }
  process.exit(0);
})();
