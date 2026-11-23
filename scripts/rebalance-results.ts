// 13 Nov 2026: re-runs the last-digit balance (src/lib/authoring/balance-results.ts) on a results file, e.g. after hand edits to scores. Writes the file back.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/rebalance-results.ts --results=scripts/data/pilot4c-results-nov13.json
import { readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const file = process.argv.find((a) => a.startsWith('--results='))?.slice(10); if (!file) { console.log('Usage: --results=file.json'); process.exit(1); }
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { balanceResults } = await import('../src/lib/authoring/balance-results');
  const cells = JSON.parse(readFileSync(file, 'utf8')) as any[];
  for (const line of balanceResults(cells, (await getPrimaryPlaceRows()) as any[])) console.log(line);
  writeFileSync(file, JSON.stringify(cells)); process.exit(0);
})();
