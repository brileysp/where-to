// 22 Oct 2026: finds bird names in the live texts (birding, wildlife viewing, whale watching, safari) that are not the eBird name, and suggests the
// eBird name for each. A DRY RUN ONLY: it writes a findings file for a person to review; nothing is changed here.
// Needs the eBird taxonomy as a CSV (curl "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=csv&cat=species" > taxonomy.csv), given as the first argument.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/sweep-bird-names-oct22.ts <taxonomy.csv> <out.json>
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

function parseCsvLine(l: string): string[] { const out: string[] = []; let cur = ''; let q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/grey/g, 'gray').replace(/[-]/g, ' ');
const tokens = (s: string) => norm(s).split(/\s+/).filter(Boolean);

(async () => {
  const [taxPath, outPath] = process.argv.slice(2);
  const lines = readFileSync(taxPath, 'utf8').split('\n').slice(1).filter(Boolean).map(parseCsvLine);
  const ebird = lines.map((c) => ({ name: c[1], sci: c[0], family: c[9] })).filter((x) => x.name);
  const exact = new Set(ebird.map((x) => x.name));
  const byNorm = new Map(ebird.map((x) => [norm(x.name), x]));
  // Head words: the last word of an eBird name (after any hyphen), used to spot bird names in the prose.
  const headCount = new Map<string, number>();
  for (const e of ebird) { const w = e.name.split(/[\s-]+/).pop()!; headCount.set(w, (headCount.get(w) ?? 0) + 1); }
  const heads = new Set([...headCount.entries()].filter(([w, n]) => n >= 4 && /^[A-Z]/.test(w)).map(([w]) => w));
  const headRe = [...heads].sort((a, b) => b.length - a.length).map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?<![\\p{L}'’-])((?:[A-Z][\\p{L}'’]+(?:-[a-z][\\p{L}]+|-[A-Z][\\p{L}]+)*[ ]){0,3}(?:${headRe})(?:-[a-z]+)?)(?:s|es)?(?![\\p{L}-])`, 'gu');

  const { db } = await import('../src/lib/db/client');
  const { places, placeInterestFacts } = await import('../src/lib/db/schema');
  const { SPECIES_CASE_INTERESTS } = await import('../src/lib/text/species-case');
  const { stripEmphasis } = await import('../src/lib/text/emphasis');
  const rows = await db.select().from(places);
  const found = new Map<string, { count: number; places: Set<string>; where: Set<string>; sample: string }>();
  const add = (name: string, place: string, where: string, ctx: string) => { const f = found.get(name) ?? { count: 0, places: new Set<string>(), where: new Set<string>(), sample: ctx }; f.count++; f.places.add(place); f.where.add(where); found.set(name, f); };
  for (const r of rows) {
    const ov = (r.sliderOverview as Record<string, string>) ?? {};
    const mo = (r.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {};
    for (const k of SPECIES_CASE_INTERESTS) {
      const texts = [ov[k], ...(mo[k] ?? [])].filter((t): t is string => !!t);
      for (const raw of texts) {
        const t = stripEmphasis(raw);
        for (const m of t.matchAll(re)) add(m[1], r.id, k, t.slice(Math.max(0, m.index! - 30), m.index! + m[0].length + 30));
      }
    }
  }
  const facts = await db.select().from(placeInterestFacts);
  for (const f of facts) {
    const hb = (f.facts as Record<string, unknown>)?.headlineBirds;
    for (const raw of Array.isArray(hb) ? hb : []) { const name = String(raw).replace(/\s*\(.*$/, '').trim(); if (name) add(name, f.placeId ?? (f as any).destinationId ?? '?', 'facts:' + f.interestKey, name); }
  }
  const results = [...found.entries()].map(([name, f]) => {
    const status = exact.has(name) ? 'ok' : byNorm.has(norm(name)) ? 'case-or-spelling' : 'unknown';
    let suggestions: string[] = [];
    if (status !== 'ok') {
      if (status === 'case-or-spelling') suggestions = [byNorm.get(norm(name))!.name];
      else {
        const tk = new Set(tokens(name));
        const head = tokens(name).pop()!;
        suggestions = ebird
          .map((e) => { const et = tokens(e.name); const inter = et.filter((x) => tk.has(x)).length; return { n: e.name, s: inter / (new Set([...et, ...tk]).size) + (et[et.length - 1] === head ? 0.15 : 0) }; })
          .filter((x) => x.s > 0.3).sort((a, b) => b.s - a.s).slice(0, 4).map((x) => x.n);
      }
    }
    return { name, status, count: f.count, places: [...f.places].slice(0, 6), nPlaces: f.places.size, where: [...f.where], sample: f.sample, suggestions };
  }).sort((a, b) => b.count - a.count);
  writeFileSync(outPath, JSON.stringify(results, null, 1));
  const by = (s: string) => results.filter((r) => r.status === s).length;
  console.log(`names found ${results.length}: exact eBird ${by('ok')}, spelling/case differs ${by('case-or-spelling')}, not an eBird name ${by('unknown')}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
