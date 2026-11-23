import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { STANDARDS } from '@/lib/authoring/standards';
import { renderStandardsDoc } from '@/lib/authoring/standards-doc';
import { SKY_RULE_IDS, STRUCTURE_RULE_IDS, TEXT_RULES } from '@/lib/authoring/rules';
import { OLD_RULE_LABELS } from '@/lib/authoring/old-rules';

const root = join(__dirname, '..', '..');

describe('standards registry', () => {
  it('has unique ids, the owner\'s words, and a way of being enforced or a judgement to state', () => {
    const ids = STANDARDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STANDARDS) {
      expect(s.words.length, `${s.id} words`).toBeGreaterThan(10);
      expect(Boolean(s.ruleIds?.length || s.checks?.length || s.judgement), `${s.id} needs a check or a judgement`).toBe(true);
    }
  });
  it('every named check exists: the file is there and the name appears in it', () => {
    for (const s of STANDARDS) for (const c of s.checks ?? []) {
      const path = join(root, c.file);
      expect(existsSync(path), `${s.id}: ${c.file} does not exist`).toBe(true);
      if (c.symbol) expect(readFileSync(path, 'utf8').includes(c.symbol), `${s.id}: "${c.symbol}" not found in ${c.file}`).toBe(true);
    }
  });
  it('every scanner rule belongs to a standard, and every rule a standard names exists', () => {
    const known = new Set<string>([...TEXT_RULES.map((r) => r.id), ...STRUCTURE_RULE_IDS, ...SKY_RULE_IDS, ...Object.keys(OLD_RULE_LABELS)]);
    const named = new Set(STANDARDS.flatMap((s) => s.ruleIds ?? []));
    const orphan = [...known].filter((id) => !named.has(id));
    expect(orphan, 'scanner rules with no standard: add the owner\'s words for them to src/lib/authoring/standards.ts').toEqual([]);
    const stale = [...named].filter((id) => !known.has(id));
    expect(stale, 'standards naming a rule that no longer exists').toEqual([]);
  });
  it('docs/standards.md is the generated document (run scripts/build-standards-doc.ts after editing the registry)', () => {
    expect(readFileSync(join(root, 'docs', 'standards.md'), 'utf8')).toBe(renderStandardsDoc());
  });
});
