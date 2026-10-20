// To-do clean-up, 19 Oct 2026 (owner: "be sure all the to-do lists are current, remove any entries that have been done").
//  1. Backs up, then deletes every to-do already marked done, plus six open ones verified done against the live data.
//  2. Refreshes the detail of open to-dos whose numbers changed.
//  3. Adds the open items from this session.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/tidy-todos-oct19.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}
const SRC = 'To-do clean-up, 19 Oct 2026';
// Open to-dos verified done on 19 Oct 2026 (id prefix -> why)
const VERIFIED_DONE: Record<string, string> = {
  '1150b33b': 'hiking is live and the sample places were fact-checked before applying',
  '9cde7361': 'surfing text went live on 17 Oct 2026 through the fact-check gate',
  'f10426b3': 'the surfing and hiking scope sheets, facts and backups are committed in git',
  '3eee6a76': 'safari density, close-up ease and spectacle filled for all 17 places on 17-19 Oct 2026 (drafts, at the owner\'s request)',
  'a1360ae5': 'wildlife density, close-up ease and spectacle filled for all 200 places on 17-19 Oct 2026 (drafts, at the owner\'s request)',
  '7bdb0adb': 'diving "How you do it" is filled for every place (0 blank)',
};
const UPDATES: Record<string, { detail?: string; status?: string; title?: string }> = {
  'ad89847d': { title: 'Last blank surfing cells', status: 'ready_for_claude', detail: 'After the 19 Oct 2026 fill (of the 106 surfing places with data): breaks 8 blank, wave direction 4, localism 3, wave size 3, boards 3, access 2, lessons 2. Permits: 20 filled (5 added 19 Oct from web checks: Fiji, Costa Rica, Bali, Sydney, Munich Eisbach), 86 blank on purpose where nothing is known; a wider web sweep for permits could add more.' },
  'cbd19321': { status: 'idea', detail: 'Only "Great herds" is still blank (14 of 17 places). Every other safari column is filled (19 Oct 2026). Leave blank where there are no herds.' },
};
type New = { interestKey: string; title: string; detail: string; status: 'needs_you' | 'ready_for_claude' | 'idea' | 'waiting'; priority?: number; dueOn?: string };
const NEW: New[] = [
  { interestKey: '_site', status: 'needs_you', priority: 1, title: 'Pick your chips on the proposals page, then tell Claude "apply my chip picks"', detail: 'https://claude.ai/artifact/BTqfgeWzrZj6AnFb7iraqT. Approve, reject or add chips; picks save on the page. Claude then adds the approval marks, deletes rejected chips (asks first for any live one) and creates your new chips as drafts. Includes the four proposed changes to live chips (Wildlife, Safari, Hiking, Birding), which are undecided.' },
  { interestKey: '_site', status: 'needs_you', priority: 1, title: 'Turn on the new onboarding flow in production', detail: 'The flow is built and tested locally (set ONBOARDING_V2=1 in the hosting environment; without it /onboarding-v2 returns 404 and /dna still shows the old flow). Hosting settings were not reachable on 17 Oct 2026.' },
  { interestKey: '_site', status: 'needs_you', title: 'Push and deploy the latest local changes', detail: 'Local commits since the last push include: species capitalization fixes, chip approvals (migration 0048), onboarding questions in the admin (migration 0049, both already applied to the database), and the new fact files for the broadened-places re-author. The admin screens for them appear only after a deploy.' },
  { interestKey: '_site', status: 'needs_you', title: 'Open onboarding decisions', detail: 'Should chips affect ranking (today they do not)? When to ask travelers to sign in? Questions are still unwritten for Surfing, Diving and Wildlife Viewing and for the ten Travel DNA dials. Hiking question 5 ("what makes a hike worth it") needs a new column.' },
  { interestKey: '_site', status: 'ready_for_claude', priority: 1, title: 'Re-author the stale text for the 14 broadened places', detail: 'Staged on 19 Oct 2026 (nothing live): birding 14 places and wildlife viewing 13 places, written against new scope sheets (docs/birding-facts.json, docs/wildlifeViewing-facts.json, scripts/data/scope-rewrite-oct19.json). Next: mechanical check, source-check every risky claim (docs/fact-check-process.md), review page with old and new text, then apply on the owner\'s approval. The "Rewrite <place> for its wider scope" to-dos close when text is applied. Wording-only fixes for beaches (Cuba, French Polynesia, Dominican Republic) and Banff aurora are ready in scripts/scope-name-fixes-oct19.ts.' },
  { interestKey: '_site', status: 'needs_you', title: 'Northern Tanzania: set diving, surfing, wind sports, whale watching and beaches to N/A?', detail: 'Their live text is about Zanzibar, which is no longer part of Northern Tanzania (the Arusha safari circuit has no sea). Setting them N/A removes those scores from the place. Not applied.' },
  { interestKey: '_site', status: 'idea', title: 'Texts that are true but cover only the old narrow area of a broadened place', detail: 'Banff hot springs (no Jasper), Vancouver & Whistler aurora (Whistler only), Palm Springs & Joshua Tree mountaineering and wildflowers (Joshua Tree only), and similar. Not wrong, so lower priority than the stale text above.' },
  { interestKey: '_site', status: 'idea', title: 'Capitalization checker for species names (like the fact-check gate)', detail: 'Rule chosen 19 Oct 2026: birds full official name in Title Case, every other animal lowercase except proper nouns/adjectives. Texts were fixed once by script; a checker would stop new text breaking it. Offered, not answered.' },
  { interestKey: '_site', status: 'ready_for_claude', title: 'Columns and data for the 18 chips approved on 19 Oct 2026', detail: 'Camping & Backcountry (car camping, backpacking, glamping, free wild camping), Geology & Volcanoes (active volcanoes, geysers and geothermal, caves and lava tubes, canyons and layered rock), Skiing (downhill resort, off-piste and backcountry, cross-country), Wind sports (kitesurfing, windsurfing, wing foiling), Kayaking & Rafting (all four). Add the data columns, fill the data, then the chips can go live.' },
  { interestKey: '_site', status: 'needs_you', title: 'Review the drafted data behind the six pilot interests\' chips', detail: 'Fine Dining, Coffee & Tea, Street Food, Shopping, Nightlife, Traditional Crafts: all ratings are Claude judgement drafts (only coffee-farm and tea-plantation ticks and about 15 Michelin counts were web-checked). Chips stay draft until you review.' },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const all = await db.select().from(interestTodos);
  const doneRows = all.filter((r) => r.status === 'done');
  const verified = all.filter((r) => r.status !== 'done' && Object.keys(VERIFIED_DONE).some((p) => r.id.startsWith(p)));
  if (verified.length !== Object.keys(VERIFIED_DONE).length) throw new Error(`verified-done ids matched ${verified.length}, expected ${Object.keys(VERIFIED_DONE).length}`);
  const toDelete = [...doneRows, ...verified];
  console.log(`delete ${doneRows.length} done + ${verified.length} verified-done; update ${Object.keys(UPDATES).length}; add ${NEW.length}`);
  if (!apply) { process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'todos-done-removed-2026-10-19.json'), JSON.stringify({ note: 'To-dos removed on 19 Oct 2026. verifiedDone lists the open ones closed after checking the live data.', verifiedDone: VERIFIED_DONE, rows: toDelete }, null, 1));
  await db.delete(interestTodos).where(inArray(interestTodos.id, toDelete.map((r) => r.id)));
  for (const [prefix, u] of Object.entries(UPDATES)) {
    const row = all.find((r) => r.id.startsWith(prefix)); if (!row) throw new Error(`no to-do ${prefix}`);
    await db.update(interestTodos).set({ ...u, updatedAt: new Date() } as never).where(eq(interestTodos.id, row.id));
  }
  await db.insert(interestTodos).values(NEW.map((n) => ({ interestKey: n.interestKey, title: n.title, detail: n.detail, status: n.status, source: SRC, priority: n.priority ?? 2, dueOn: n.dueOn ?? null })));
  console.log('done');
  process.exit(0);
})();
