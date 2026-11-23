// Renders docs/standards.md from the registry (src/lib/authoring/standards.ts). The test compares the file with this output, so the document can never drift from the registry.
import { STANDARDS, type Standard, type StandardLevel } from './standards';

const LEVELS: Array<{ level: StandardLevel; heading: string; blurb: string }> = [
  { level: 'cell', heading: 'A cell (one place, one interest)', blurb: 'Judged on each cell separately. A batch total can look fine while a single cell is wrong.' },
  { level: 'batch', heading: 'A batch', blurb: 'Judged on the new batch by itself, not inside the catalog.' },
  { level: 'interest', heading: 'An interest', blurb: 'Judged across the places of one interest.' },
  { level: 'page', heading: 'A review page', blurb: 'How a page for the owner is built.' },
  { level: 'process', heading: 'How we work', blurb: 'Not about any one cell: the habits that stop the same mistakes coming back.' },
];

const how = (s: Standard) => {
  const parts: string[] = [];
  if (s.ruleIds?.length) parts.push(`scanner rules: ${s.ruleIds.map((r) => `\`${r}\``).join(', ')}`);
  if (s.checks?.length) parts.push(`checks: ${s.checks.map((c) => `\`${c.file}${c.symbol ? `::${c.symbol}` : ''}\``).join(', ')}`);
  return parts.length ? `Enforced by ${parts.join('; ')}.` : '';
};

export function renderStandardsDoc(): string {
  const out: string[] = [];
  out.push('# Standards for content work', '');
  out.push('Generated from `src/lib/authoring/standards.ts` by `npx tsx scripts/build-standards-doc.ts`. Edit the registry, not this file (a test fails if they differ).', '');
  out.push('This is the one list of the owner\'s rules. Read it before authoring, reviewing or reporting on content. Each rule has her words and the date, the level she reads it at, and how it is enforced: named checks that exist in the repo, or JUDGEMENT, meaning no code can decide it and I must state evidence at every hand-off.', '');
  out.push('**Hand-off rule.** Before showing the owner anything, run `PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/standards-report.ts --results=<file>`, paste what it finds worst-first, and answer every judgement standard it lists. Say what was not checked.', '');
  out.push('**Correction rule.** When the owner corrects something, in the same turn: add or change the standard here, add her example as a failing test, make a check fail on it, then fix it. If it cannot be a check, it is a judgement standard with the evidence I must give.', '');
  for (const l of LEVELS) {
    const list = STANDARDS.filter((s) => s.level === l.level);
    if (!list.length) continue;
    out.push(`## ${l.heading}`, '', l.blurb, '');
    for (const s of list) {
      out.push(`### ${s.id}. ${s.title}`, '', `Owner: ${s.words}`, '');
      const h = how(s); if (h) out.push(h, '');
      if (s.judgement) out.push(`Judgement: ${s.judgement}`, '');
      if (s.memory) out.push(`Story and reasons: memory note \`${s.memory}\`.`, '');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
