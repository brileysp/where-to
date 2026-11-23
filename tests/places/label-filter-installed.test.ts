import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');

// 18 Nov 2026, step 6 of the naming plan: the reporting and pipeline scripts cannot print a place key (standard D03). A refactor that drops the filter from one of them fails here.
describe('reports print labels, never keys', () => {
  const scripts = ['standards-report', 'build-review-page', 'gemini-batch', 'finish-interest', 'interest-status', 'apply-family-text', 'fact-check', 'build-pilot-facts', 'check-hotel-season', 'import-hotel-season', 'gemini-author-batch', 'interest-completeness', 'check-place-identity'];
  it.each(scripts)('%s installs the label filter', (name) => {
    expect(readFileSync(join(root, 'scripts', `${name}.ts`), 'utf8')).toContain('installLabelFilter()');
  });
  it('the scripts that check text also rebuild the old-name list from the label history first', () => {
    for (const name of ['standards-report', 'gemini-batch', 'apply-family-text', 'gemini-author-batch']) expect(readFileSync(join(root, 'scripts', `${name}.ts`), 'utf8')).toContain('syncRenamedPlacesFile()');
  });
});
