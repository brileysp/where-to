// 18 Nov 2026, step 3 of docs/place-naming-plan.md: rewrites old place ids to keys in the live JSON data files (docs, scripts/data, content/destinations, tests).
// Default is a DRY RUN that only reports. --out=<dir> writes the rewritten files into a mirror folder (nothing live is touched). --apply rewrites in place after making a tar backup.
// Never touched: backups, archives, anything with "before" or "backup" in its name, and .cache. Free text that merely contains an id is never changed (src/lib/places/rekey.ts).
// Usage: npx tsx scripts/rekey-place-files.ts [--out=.cache/rekey-preview] [--apply] [--list]
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync, unlinkSync } from 'fs'; import { join, relative, dirname } from 'path'; import { execSync } from 'child_process';
import { rekeyJson, type RekeyStats } from '../src/lib/places/rekey';
const ROOT = join(__dirname, '..'); const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const map = JSON.parse(readFileSync(join(ROOT, 'scripts/data/place-keys-nov18.json'), 'utf8')).keys as Record<string, string>;
const SKIP = /(^|\/)(backups|archive|node_modules|\.cache|\.next)(\/|$)|before|backup/i;
// Left exactly as they are: the key map itself, and the hotel panel files, whose keys are Booking.com panel names that merely look like ids (they map to places through hotel-place-map-nov15.json, whose VALUES are rewritten but not its keys).
const EXCLUDE = /(^|\/)(place-keys-nov18\.json|hotel-quote-panel-[^/]*\.json)$/; const VALUES_ONLY = /(^|\/)hotel-place-map-nov15\.json$/;
const roots = ['docs', 'scripts/data', 'content/destinations', 'tests'];
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); const rel = relative(ROOT, p); if (SKIP.test(rel) || EXCLUDE.test(rel)) return []; return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : []; });
const indentOf = (raw: string): string | number | undefined => { const m = raw.match(/^[\[{]\r?\n([ \t]+)\S/); return m ? (m[1].includes('\t') ? '\t' : m[1].length) : undefined; };
(async () => {
  const out = arg('out'); const apply = process.argv.includes('--apply'); const list = process.argv.includes('--list');
  const labels = new Map<string, string>((JSON.parse(readFileSync(join(ROOT, '.cache/place-rows.json'), 'utf8')) as any[]).map((r) => [r.id, r.name])); // the seed files carry stale names (content/destinations/bagan.json says Bagan); they get today's label
  const report: Array<{ file: string; s: RekeyStats; error?: string }> = []; const changed: Array<{ file: string; text: string; moveTo?: string; oldFile?: string }> = []; let scanned = 0;
  for (const r of roots) for (const file of existsSync(join(ROOT, r)) ? walk(join(ROOT, r)) : []) {
    scanned += 1; const raw = readFileSync(file, 'utf8'); let data: unknown; try { data = JSON.parse(raw); } catch { continue; }
    const s: RekeyStats = { keys: 0, values: 0, composites: 0 }; let next: unknown;
    try { next = rekeyJson(data, map, s, { valuesOnly: VALUES_ONLY.test(relative(ROOT, file)) }); } catch (e: any) { report.push({ file: relative(ROOT, file), s, error: e.message }); continue; }
    const rel = relative(ROOT, file); const seedId = rel.match(/^content\/destinations\/([^/]+)\.json$/)?.[1]; let moveTo: string | undefined;
    if (seedId && map[seedId]) { moveTo = join(dirname(file), `${map[seedId]}.json`); const o: any = next; if (labels.get(map[seedId])) o.name = labels.get(map[seedId]); s.values += 1; }
    if (!s.keys && !s.values && !s.composites) continue;
    const ind = indentOf(raw); const text = JSON.stringify(next, null, ind) + (raw.endsWith('\n') ? '\n' : '');
    report.push({ file: rel, s }); changed.push({ file: moveTo ?? file, text, moveTo, oldFile: moveTo ? file : undefined });
  }
  const tot = report.reduce((a, r) => ({ keys: a.keys + r.s.keys, values: a.values + r.s.values, composites: a.composites + r.s.composites }), { keys: 0, values: 0, composites: 0 });
  console.log(`${scanned} JSON files scanned in ${roots.join(', ')}; ${report.length} would change (${tot.keys} keys, ${tot.values} whole values, ${tot.composites} composites); ${report.filter((r) => r.error).length} errors.`);
  if (list || (!out && !apply)) for (const r of report.sort((a, b) => b.s.keys + b.s.values + b.s.composites - (a.s.keys + a.s.values + a.s.composites))) console.log(`  ${String(r.s.keys).padStart(5)} keys ${String(r.s.values).padStart(5)} values ${String(r.s.composites).padStart(4)} composites  ${r.file}${r.error ? '  ERROR ' + r.error : ''}`);
  if (report.some((r) => r.error)) { console.log('Stopping: fix the errors first.'); process.exit(1); }
  if (out) { for (const c of changed) { const dest = join(ROOT, out, relative(ROOT, c.file)); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, c.text); } console.log(`Wrote ${changed.length} rewritten files to ${out} (nothing live changed).`); }
  if (apply) { const tar = join(ROOT, `.cache/rekey-backup-${Date.now()}.tar`); mkdirSync(join(ROOT, '.cache'), { recursive: true }); execSync(`tar -cf "${tar}" -C "${ROOT}" ${changed.map((c) => `"${relative(ROOT, c.oldFile ?? c.file)}"`).join(' ')}`, { maxBuffer: 1 << 28 }); for (const c of changed) { writeFileSync(c.file, c.text); if (c.oldFile) unlinkSync(c.oldFile); } console.log(`Rewrote ${changed.length} files in place. Backup: ${relative(ROOT, tar)}`); }
  process.exit(0);
})();
