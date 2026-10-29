// Runs the known truths (src/lib/truths/truths.ts) against the live database and writes docs/known-truths.md.
// Usage: npm run truths          (exits with an error if any truth FAILS; PENDING ones do not fail)
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { loadTruthContext } = await import('../src/lib/truths/load');
  const { runTruths } = await import('../src/lib/truths/truths');
  const ctx = await loadTruthContext();
  const out = runTruths(ctx);
  const n = (s: string) => out.filter((o) => o.status === s).length;
  const icon = { pass: 'PASS', fail: 'FAIL', pending: 'PENDING', fixed: 'FIXED' } as const;
  for (const o of out) console.log(`${icon[o.status].padEnd(7)} ${o.truth.id}  ${o.truth.says}${o.detail ? `\n          -> ${o.detail}` : ''}${o.status === 'pending' ? `\n          (pending: ${o.truth.pending})` : ''}${o.status === 'fixed' ? '\n          (this pending truth now holds: remove its pending note)' : ''}`);
  console.log(`\n${out.length} truths: ${n('pass')} pass, ${n('fail')} FAIL, ${n('pending')} pending, ${n('fixed')} fixed-but-still-marked-pending`);
  const md: string[] = ['# Known truths', '', `Checked ${new Date().toISOString().slice(0, 10)}. Each line is something that must always be true of Where To?, written as a test that can fail. Run \`npm run truths\` to check them against the live data.`, '', `**${out.length} truths: ${n('pass')} hold, ${n('fail')} fail, ${n('pending')} pending.** Pending means we know it does not hold yet and what will close it.`, ''];
  for (const area of [...new Set(out.map((o) => o.truth.area))]) {
    md.push(`## ${area}`, '', '| | Truth | Note |', '|---|---|---|');
    for (const o of out.filter((x) => x.truth.area === area)) md.push(`| ${o.status === 'pass' ? 'holds' : o.status === 'fail' ? '**FAILS**' : o.status === 'pending' ? 'pending' : 'now holds'} | ${o.truth.id}: ${o.truth.says} | ${o.status === 'fail' ? (o.detail ?? '') : o.status === 'pending' ? o.truth.pending : ''} |`);
    md.push('');
  }
  writeFileSync(join(__dirname, '..', 'docs', 'known-truths.md'), md.join('\n'));
  process.exit(n('fail') > 0 ? 1 : 0);
})().catch((e) => { console.log('ERR', e.stack ?? e.message); process.exit(2); });
