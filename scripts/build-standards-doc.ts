// Writes docs/standards.md from the registry in src/lib/authoring/standards.ts. Usage: npx tsx scripts/build-standards-doc.ts
import { writeFileSync } from 'fs'; import { join } from 'path';
(async () => {
  const { renderStandardsDoc } = await import('../src/lib/authoring/standards-doc');
  writeFileSync(join(__dirname, '..', 'docs', 'standards.md'), renderStandardsDoc());
  console.log('wrote docs/standards.md');
  process.exit(0);
})();
