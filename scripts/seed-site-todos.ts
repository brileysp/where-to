// Puts the site-wide items on the To do tab (interest key "_site"). Safe to re-run: an item whose title already exists is skipped.
// Sourced from the 6 Oct 2026 "Site To-Do List" artifact and docs/todo.md, checked against the code and live data on 14 Oct 2026.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

type Status = 'needs_you' | 'ready_for_claude' | 'waiting' | 'idea';
type Item = { title: string; detail: string; status: Status; priority: 1 | 2 | 3; source: string; dueOn?: string; repeatEvery?: 'weekly' | 'monthly' };

const ITEMS: Item[] = [
  // ---- Deadlines and checks ----
  { title: 'Check Supabase usage', status: 'needs_you', priority: 1, dueOn: '2026-10-17', source: 'Usage page, 14 Oct 2026: 0.151 GB of 5 GB used',
    detail: 'Open Supabase, Organization, Usage. Egress should be about 20 to 50 MB on an ordinary day. If a quiet day is still near 150 MB, build the shared-cache step of the egress plan (docs/egress-reduction-plan.md).' },
  { title: 'Check Supabase usage again', status: 'needs_you', priority: 1, dueOn: '2026-10-21', source: 'Follow-up to the 17 Oct check',
    detail: 'Safe if the month so far is under about 1.5 GB. The billing cycle runs 14 Oct to 14 Nov.' },
  { title: 'Grace period ends: confirm no restriction', status: 'waiting', priority: 2, dueOn: '2026-11-03', source: 'Supabase banner, 14 Oct 2026',
    detail: 'Supabase restricts projects from 4 Nov only if the organization is still over quota. Look at the Usage page the day before. Decide on Pro only if the month is trending over 5 GB.' },
  { title: 'Decide whether to upgrade Supabase to Pro', status: 'idea', priority: 3, source: 'Site To-Do List, 6 Oct 2026; usage rechecked 14 Oct',
    detail: 'Last cycle used 5.7 of 5 GB. Since then the public list, audit log and history pages were slimmed, and the first day of this cycle used 3%. Decide after the 21 Oct check.' },

  // ---- Housekeeping from the live push ----
  { title: 'Back up the local-only surfing and hiking files', status: 'ready_for_claude', priority: 2, source: 'Push to live, 14 Oct 2026',
    detail: 'Scope sheets, draft facts, edit files and the local backups (docs/backups) exist only on this computer. Copy them to a backup folder now, and commit the approved ones after the surfing and hiking text is applied.' },
  { title: 'Check the live admin matches the local one', status: 'needs_you', priority: 2, source: 'Push to live, 14 Oct 2026',
    detail: 'On the Vercel site: home-country picker, Rules tabs for Surfing, Whale watching and Hiking, diving "How you do it" pills, and this To do tab.' },
  { title: 'Add the passcode and admin email to Vercel preview builds', status: 'idea', priority: 3, source: 'Vercel setup, 14 Oct 2026',
    detail: 'Only Production has SITE_PASSCODE and ADMIN_EMAIL, so branch previews cannot sign in to the admin.' },

  // ---- Speed and cost ----
  { title: 'Egress plan steps 3 and 4: separate text table and a shared cache', status: 'idea', priority: 3, source: 'Catalog size plan, 14 Oct 2026',
    detail: 'Steps 1 and 2 (public list without text, text loaded per place) are built. Step 3 moves overviews and monthly text to their own table; step 4 shares the cache between servers. Only worth doing if the usage checks show egress still rising.' },
  { title: 'Thin the old human edit-history entries', status: 'idea', priority: 3, source: 'Audit-log slimming, 13 Oct 2026',
    detail: 'About 4 MB of full before/after copies from human edits are kept on purpose. Thin them the same way as the script entries if the database size ever matters again (it is 73 MB of 500 MB now).' },
  { title: 'Avoid repeated production builds', status: 'idea', priority: 3, source: 'docs/todo.md',
    detail: '`next build` starts about 15 workers that each download the catalog. Use the type check and tests while working, and set PLACE_ROWS_SNAPSHOT=1 for scripts.' },

  // ---- New admin screens ----
  { title: 'Ranked "lowest completeness" list on the admin home', status: 'idea', priority: 3, source: 'Completeness score work, 6 Oct 2026', detail: 'Not built. The score shows on the Interests tab and each interest page.' },
  { title: 'Per-place completeness score and "check scores" flag in Places & data', status: 'idea', priority: 3, source: 'Completeness score work, 6 Oct 2026', detail: 'Not built. The score refreshes on page reload, not live while you edit.' },
  { title: 'Weekly completeness snapshot for a trend line', status: 'idea', priority: 3, source: 'Completeness score work, 6 Oct 2026', detail: 'Not built.' },
  { title: 'Cell states for interest columns', status: 'needs_you', priority: 3, source: 'Admin editing build, 13 Oct 2026', detail: 'Two mockups exist (Cell States Proposal and Cell States Simplified). Pick one and I build it.' },
  { title: 'Show hidden place fields in the admin', status: 'idea', priority: 3, source: 'docs/todo.md', detail: 'Curve source pill on the matrix, isPublished column on Places, and scoreStatus, scoreInheritedFrom, stampDesign and parentPlaceId have no column yet.' },

  // ---- Content backlog ----
  { title: 'Author the remaining interest content', status: 'ready_for_claude', priority: 2, source: 'Interest content playbook',
    detail: 'Many interests still have no live text. Read docs/interest-content-authoring-playbook.md first. Next in line: the on-foot family (hiking, scenic landscapes, landscape photography, camping, trail running), then sailing and kayaking/rafting.' },
  { title: 'Decimalization pass for the remaining coarse interests', status: 'idea', priority: 3, source: 'Decimalization pass', detail: 'Surfing, hot springs and beaches still show whole and half numbers. Wildlife, wildflowers, wind sports, birding and diving are done.' },
  { title: 'Import more Catalog Wishlist lists', status: 'idea', priority: 3, source: 'Future places across lists', detail: 'Check the old wishlist and every interest\'s Future places list first; duplicates share one name and an "Also on" note.' },
  { title: 'hotSprings sources', status: 'idea', priority: 3, source: 'docs/todo.md', detail: '27 places have hot springs content and no logged sources. Either re-verify with real sources or leave unlogged.' },
  { title: 'National parks: decide whether it becomes a tag or type of place', status: 'idea', priority: 3, source: 'docs/todo.md', detail: 'It is not an interest.' },

  // ---- Public site and tooling ----
  { title: 'Public-page banner for travel advisories', status: 'idea', priority: 3, source: 'Destination advisory layer', detail: 'The advisory field and admin tab exist but are empty; the visitor-facing banner is not built. A later phase.' },
  { title: 'Unreproduced broken-render report on the results page', status: 'idea', priority: 3, source: 'Open public-page bug', detail: 'Reported once, never reproduced or resolved.' },
  { title: 'Cost-checking agent', status: 'idea', priority: 3, source: 'Cost-item tracking', detail: 'Saves edits as kind "agent"; the grid already shows the robot icon. Only admin-panel edits are tracked so far.' },
  { title: 'Move Gemini calls to a newer model', status: 'idea', priority: 3, source: 'Gemini pipeline', detail: 'Parameters change when that happens. The thinking cap stays on.' },
  { title: 'Standing reminder: ask for the full review pass once an interest is fully generated', status: 'idea', priority: 3, source: 'Gemini content pipeline', detail: 'Claude owes this reminder whenever an interest finishes generating.' },
];

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const have = new Set((await db.select({ title: interestTodos.title }).from(interestTodos).where(eq(interestTodos.interestKey, '_site'))).map((r) => r.title));
  let made = 0;
  for (const it of ITEMS) {
    if (have.has(it.title)) continue;
    const values = { interestKey: '_site', title: it.title, detail: it.detail, status: it.status, source: it.source, priority: it.priority, dueOn: it.dueOn ?? null, repeatEvery: it.repeatEvery ?? null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: '_site:new', action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    made++;
  }
  console.log(`created ${made} of ${ITEMS.length} site-wide items`);
  process.exit(0);
})();
