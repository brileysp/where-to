'use client';

import { useMemo, useState } from 'react';
import type { InterestPageData, InterestPlaceRow } from '@/lib/admin/interest-pages/types';
import type { FactDef } from '@/lib/admin/interest-pages/config';
import type { InterestFactValue } from '@/lib/db/schema';
import { FACT_GROUP_LABELS, likelihoodRank, optionLabel } from '@/lib/admin/interest-pages/config';
import { factToText } from './FactCell';

const MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function strongest(monthly: number[]): string {
  if (!monthly.length) return '';
  const mx = Math.max(...monthly);
  const good = monthly.map((v) => v >= mx - 0.5);
  if (good.every(Boolean)) return 'Year-round';
  const out: string[] = [];
  let i = 0;
  while (i < 12) {
    if (good[i]) {
      let j = i;
      while (j + 1 < 12 && good[j + 1]) j++;
      out.push(i === j ? MN[i] : `${MN[i]}–${MN[j]}`);
      i = j + 1;
    } else i++;
  }
  return out.join(', ');
}

function Months({ monthly }: { monthly: number[] }) {
  return (
    <>
      <div className="ip-months">{monthly.map((v, i) => <i key={i} title={String(v)} style={{ height: `${(v / 10) * 100}%`, opacity: 0.35 + (v / 10) * 0.65 }} />)}</div>
      <div className="ip-mlab">{MON.map((m, i) => <span key={i}>{m}</span>)}</div>
    </>
  );
}

export function CompareView({ data, places, defs }: { data: InterestPageData; places: InterestPlaceRow[]; defs: FactDef[] }) {
  const options = useMemo(() => places.filter((p) => p.status !== 'na'), [places]);
  const initial = (id: string, fallback: number) => (options.find((p) => p.id === id) ? id : options[fallback]?.id ?? '');
  const [aId, setA] = useState(initial(data.key === 'safari' ? 'tanzania' : 'ecuadorian-andes', 0));
  const [bId, setB] = useState(initial(data.key === 'safari' ? 'kruger' : 'colombian-andes', 1));
  const a = options.find((p) => p.id === aId);
  const b = options.find((p) => p.id === bId);
  if (!a || !b) return <div className="ip-card ip-faint">Pick two places with data.</div>;

  const peak = (p: InterestPlaceRow) => Math.max(...p.monthly);
  const num = (p: InterestPlaceRow, k: string) => (typeof p.facts[k] === 'number' ? (p.facts[k] as number) : null);
  const missing = <span>not recorded yet</span>;

  function row(label: string, x: React.ReactNode, y: React.ReactNode, win?: 'a' | 'b' | null, miss?: [boolean, boolean]) {
    return (
      <tr key={label}>
        <td>{label}</td>
        <td className={miss?.[0] ? 'missing' : win === 'a' ? 'win' : ''}>{miss?.[0] ? missing : x}</td>
        <td className={miss?.[1] ? 'missing' : win === 'b' ? 'win' : ''}>{miss?.[1] ? missing : y}</td>
      </tr>
    );
  }

  const diffs: string[] = [];
  const numericDefs = defs.filter((d) => (d.type === 'int' || d.type === 'rating') && (d.group === 'data' || d.group === 'experience'));
  for (const d of numericDefs) {
    const x = num(a, d.key), y = num(b, d.key);
    if (x === null || y === null || x === y) continue;
    const hi = x > y ? a : b, lo = hi === a ? b : a;
    diffs.push(`${hi.name} is higher on ${d.label.toLowerCase()} (${num(hi, d.key)} vs ${num(lo, d.key)}).`);
  }
  const sa = strongest(a.monthly), sb = strongest(b.monthly);
  if (sa !== sb) diffs.push(`Timing differs: ${a.name} is strongest ${sa}; ${b.name} ${sb}.`);
  const headKey = defs.some((d) => d.key === 'headlineAnimals') ? 'headlineAnimals' : 'headlineBirds';
  const headTitle = headKey === 'headlineAnimals' ? 'Headline animals' : 'Headline birds';
  // Headline lists are either plain arrays (older data) or "Name (likelihood), Name (likelihood)" text; compare by name only.
  const headNames = (v: InterestFactValue | undefined): string[] =>
    (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/,\s*(?![^()]*\))/) : []).map((x) => x.replace(/\s*\(.*\)\s*$/, '').trim()).filter(Boolean);
  const birdsA = headNames(a.facts[headKey]);
  const birdsB = headNames(b.facts[headKey]);
  const lkDefs = defs.filter((d) => d.type === 'likelihood');
  for (const d of lkDefs) {
    const x = likelihoodRank(a.facts[d.key]), y = likelihoodRank(b.facts[d.key]);
    if (x < 0 || y < 0 || x === y) continue;
    const hi = x > y ? a : b, lo = hi === a ? b : a;
    diffs.push(`${d.label}: ${optionLabel(d, hi.facts[d.key])} at ${hi.name}, ${optionLabel(d, lo.facts[d.key])} at ${lo.name}.`);
  }
  const gaps = defs.filter((d) => d.group !== 'draw' && num(a, d.key) === null && num(b, d.key) === null && factToText(d, a.facts[d.key]) === '' && factToText(d, b.facts[d.key]) === '');
  if (diffs.length === 0) diffs.push('Nothing to separate these two yet on the recorded data.');

  const sections: Array<{ title: string; defs: FactDef[] }> = (['data', 'species', 'style', 'experience', 'practical', 'draw', 'planning'] as const).map((g) => ({ title: FACT_GROUP_LABELS[g].label, defs: defs.filter((d) => d.group === g && d.type !== 'birds' && d.type !== 'list' && d.type !== 'bool' && d.key !== 'draw' && d.key !== headKey) })).filter((s) => s.defs.length);

  return (
    <div className="ip-section">
      <div className="ip-cmp-pick">
        <div className="ip-faint">Pick any two places.</div>
        <select value={aId} onChange={(e) => setA(e.target.value)}>{options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={bId} onChange={(e) => setB(e.target.value)}>{options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div className="ip-card">
        <h4>Main differences</h4>
        <ul className="ip-list">{diffs.map((d) => <li key={d}>{d}</li>)}</ul>
        {gaps.length > 0 && <div className="ip-faint" style={{ marginTop: 8, fontSize: 12 }}>Not recorded for either place yet: {gaps.map((g) => g.label).join(', ')}.</div>}
      </div>
      <div className="ip-table-wrap">
        <table className="ip-table ip-cmp">
          <tbody>
            <tr className="sec"><td colSpan={3}>Score</td></tr>
            {row('Peak score (live)', peak(a).toFixed(1), peak(b).toFixed(1), peak(a) === peak(b) ? null : peak(a) > peak(b) ? 'a' : 'b')}
            <tr><td>Through the year</td><td><Months monthly={a.monthly} /></td><td><Months monthly={b.monthly} /></td></tr>
            {row('Strongest months', sa, sb)}
            {sections.map((s) => (
              <FragmentRows key={s.title} title={s.title}>
                {s.defs.map((d) => {
                  const x = a.facts[d.key], y = b.facts[d.key];
                  const nx = typeof x === 'number' ? x : null, ny = typeof y === 'number' ? y : null;
                  const win = d.type === 'likelihood'
                    ? (likelihoodRank(x) >= 0 && likelihoodRank(y) >= 0 && likelihoodRank(x) !== likelihoodRank(y) ? (likelihoodRank(x) > likelihoodRank(y) ? 'a' : 'b') : null)
                    : nx !== null && ny !== null && nx !== ny && (d.group === 'data' || d.group === 'experience') ? (nx > ny ? 'a' : 'b') : null;
                  return row(d.label, factToText(d, x), factToText(d, y), win, [factToText(d, x) === '', factToText(d, y) === '']);
                })}
              </FragmentRows>
            ))}
            {(birdsA.length > 0 || birdsB.length > 0) && (
              <FragmentRows title={headTitle}>
                <tr><td>Both</td><td colSpan={2}>{birdsA.filter((x) => birdsB.includes(x)).join(', ') || <span className="ip-faint">none in common</span>}</td></tr>
                <tr><td>Only here</td><td>{birdsA.filter((x) => !birdsB.includes(x)).join(', ')}</td><td>{birdsB.filter((x) => !birdsA.includes(x)).join(', ')}</td></tr>
              </FragmentRows>
            )}
            {defs.some((d) => d.key === 'draw') && (
              <FragmentRows title="Confidence">
                {row('Draw rating', String(a.facts.draw ?? ''), String(b.facts.draw ?? ''), null, [!a.facts.draw, !b.facts.draw])}
                {row(headKey === 'headlineAnimals' ? 'Draw animals source-checked' : 'Draw birds source-checked', a.facts.drawSourceChecked ? 'yes' : 'no', b.facts.drawSourceChecked ? 'yes' : 'no')}
              </FragmentRows>
            )}
          </tbody>
        </table>
      </div>
      <div className="ip-note"><b>How this will grow.</b> Every row above comes from a recorded fact. A blank cell means nobody has filled that fact in for the place, and it is ignored when working out the differences. Fill in more columns on the data table and this comparison gets richer with no other change. {data.label} comparisons only use the columns defined for it.</div>
    </div>
  );
}

function FragmentRows({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="sec"><td colSpan={3}>{title}</td></tr>
      {children}
    </>
  );
}
