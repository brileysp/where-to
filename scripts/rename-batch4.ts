import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Batch 4 (Oct 2026): two renames that narrow a place, two future places added to the diving/snorkeling ideas list,
// and per-interest to-dos that carry the new scope. Old names are fixed below so re-running never writes a wrong "was".
const CHANGES: Record<string, { oldName: string; name: string; addAliases: string[]; dropAliases: string[] }> = {
  thailand: { oldName: 'Thailand — Phuket & Islands', name: 'Phuket & the Andaman Coast', addAliases: ['Andaman Coast', 'Khao Lak', 'Khao Sok', 'Similan Islands'], dropAliases: [] },
  tanzania: { oldName: 'Serengeti & Zanzibar', name: 'Northern Tanzania', addAliases: ['Arusha', 'Tarangire', 'Lake Manyara', 'Arusha National Park'], dropAliases: ['Zanzibar'] },
};
const SOURCE = 'Place rename, 7 Oct 2026';
const ANDAMAN = 'Scope: Phuket, Krabi, Phi Phi, Khao Lak, the Similan Islands and Khao Sok. Anything about Koh Samui and the Gulf islands moves to the future Koh Samui & Gulf Islands place (on the diving and snorkeling list).';
const NORTH = 'Scope: the full Arusha safari circuit. Safari focuses on the Serengeti and Ngorongoro. Landscape includes Lake Manyara and Tarangire. Birding includes Tarangire and Arusha National Park. Zanzibar is no longer part of this place.';
const ZANZ = 'The current text and scores describe Zanzibar, which is no longer part of this place. Keep it as source material for the future Zanzibar place (on the diving and snorkeling list), and decide whether Northern Tanzania should be N/A for this interest.';
const CUSTOM: Record<string, Record<string, { title: string; detail: string }>> = {
  thailand: {},
  tanzania: {
    safari: { title: 'Rewrite Northern Tanzania for its new scope (was Serengeti & Zanzibar)', detail: `Fields to rewrite: the overview, all 12 monthly blurbs and the 12 monthly scores. ${NORTH}` },
    wildlifeViewing: { title: 'Rewrite Northern Tanzania for its new scope (was Serengeti & Zanzibar)', detail: `Fields to rewrite: the overview, all 12 monthly blurbs and the 12 monthly scores, for the northern circuit parks. ${NORTH}` },
    birding: { title: 'Rewrite Northern Tanzania for its new scope (was Serengeti & Zanzibar)', detail: `Fields to rewrite: the overview, all 12 monthly blurbs and the 12 monthly scores. Birding covers Tarangire and Arusha National Park in particular. ${NORTH}` },
    scenicLandscapes: { title: 'Rewrite Northern Tanzania scores for its new scope (was Serengeti & Zanzibar)', detail: `Scores only today. Re-score for the northern circuit and include Lake Manyara and Tarangire for landscape alongside the Serengeti and Ngorongoro. ${NORTH}` },
    mountaineering: { title: 'Decide whether Kilimanjaro stays in Northern Tanzania (was Serengeti & Zanzibar)', detail: 'The mountaineering text covers Kilimanjaro. The new scope note lists the safari circuit and does not mention it, so decide whether it stays, then rewrite or remove the text and scores.' },
    beachesSwimming: { title: 'Zanzibar text to move out of Northern Tanzania (was Serengeti & Zanzibar)', detail: ZANZ },
    diving: { title: 'Zanzibar text to move out of Northern Tanzania (was Serengeti & Zanzibar)', detail: ZANZ },
    whaleWatching: { title: 'Zanzibar text to move out of Northern Tanzania (was Serengeti & Zanzibar)', detail: `${ZANZ} The whale columns for this place also describe the Zanzibar coast.` },
    surfing: { title: 'Zanzibar text to move out of Northern Tanzania (was Serengeti & Zanzibar)', detail: ZANZ },
    windSports: { title: 'Zanzibar text to move out of Northern Tanzania (was Serengeti & Zanzibar)', detail: ZANZ },
  },
};
const DEFAULT_DETAIL: Record<string, (oldName: string, name: string) => { title: string; detail: string }> = {
  thailand: (o, n) => ({ title: `Rewrite ${n} for its narrower scope (was ${o})`, detail: `Fields to rewrite: the overview, all 12 monthly blurbs and the 12 monthly scores. ${ANDAMAN}` }),
  tanzania: (o, n) => ({ title: `Rewrite ${n} for its new scope (was ${o})`, detail: `Fields to rewrite: the overview, all 12 monthly blurbs and the 12 monthly scores. ${NORTH}` }),
};
const IDEAS = [
  { name: 'Koh Samui & Gulf Islands', region: 'Thailand', why: 'Gulf of Thailand diving and snorkeling, with Koh Tao a major dive-training hub. Best roughly January to September, wettest in October and November, which is the opposite of the Andaman coast.', nearestExisting: 'Phuket & the Andaman Coast', placeType: 'Tropical Asia' },
  { name: 'Zanzibar', region: 'Tanzania', why: 'Spice-island beaches and reef snorkeling (Mnemba), with dolphin trips. Best roughly June to October; the long rains in April and May are the one to avoid. Split out of the old Serengeti & Zanzibar place.', nearestExisting: 'Northern Tanzania', placeType: 'Africa' },
];

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places, interestTodos, interestPlaceIdeas } = await import('../src/lib/db/schema');
  const { inArray, and, eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const label = (k: string) => SLIDERS.find((s) => s.key === k)?.label ?? k;

  const rows = await db.select().from(places).where(inArray(places.id, Object.keys(CHANGES)));
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  for (const r of rows) {
    const c = CHANGES[r.id];
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    patches.push({ ...base, field: 'name', value: c.name });
    let aliases = r.searchAliases.filter((a) => !c.dropAliases.some((d) => d.toLowerCase() === a.toLowerCase()));
    for (const a of c.addAliases.concat([c.oldName])) if (!aliases.some((x) => x.toLowerCase() === a.toLowerCase())) aliases = [...aliases, a];
    patches.push({ ...base, field: 'searchAliases', value: aliases });
  }
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('renamed', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  if (res.errors.length || res.conflicts.length) process.exit(1);

  // Future places on the diving and snorkeling list.
  let ideasAdded = 0;
  for (const idea of IDEAS) {
    const [ex] = await db.select({ id: interestPlaceIdeas.id }).from(interestPlaceIdeas).where(and(eq(interestPlaceIdeas.interestKey, 'diving'), eq(interestPlaceIdeas.name, idea.name)));
    if (ex) continue;
    const values = { interestKey: 'diving', ...idea, stage: 'idea' as const };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: 'diving:new', action: 'create', before: null, after: values, write: (tx) => tx.insert(interestPlaceIdeas).values(values).returning() });
    ideasAdded++;
  }

  // To-dos.
  type Todo = { title: string; detail: string; status: 'ready_for_claude' | 'idea' };
  const wanted = new Map<string, Todo[]>();
  const add = (k: string, t: Todo) => wanted.set(k, [...(wanted.get(k) ?? []), t]);
  const curveOnly = new Map<string, string[]>();
  for (const r of rows) {
    const c = CHANGES[r.id];
    const written = Object.keys(r.sliderOverview ?? {}).filter((k) => (r.sliderOverview as Record<string, string>)[k]);
    const custom = CUSTOM[r.id] ?? {};
    for (const k of written) add(k, { ...(custom[k] ?? DEFAULT_DETAIL[r.id](c.oldName, c.name)), status: 'ready_for_claude' });
    for (const k of Object.keys(custom)) if (!written.includes(k)) add(k, { ...custom[k], status: 'ready_for_claude' });
    const curves = (Array.isArray(r.authoredCurves) ? r.authoredCurves : []) as string[];
    for (const k of curves) { if (written.includes(k) || custom[k]) continue; curveOnly.set(k, [...(curveOnly.get(k) ?? []), `${c.name} (was ${c.oldName})`]); }
  }
  for (const [k, names] of curveOnly) add(k, { title: `Re-check ${label(k)} scores for broadened places`, detail: `These places have monthly scores for ${label(k)} (no written text) that were set for the old scope: ${names.join('; ')}. Re-check the monthly scores for the new area; write text only if wanted.`, status: 'idea' });

  let created = 0, updated = 0, skipped = 0;
  for (const [interestKey, items] of wanted) {
    for (const t of items) {
      const [ex] = await db.select().from(interestTodos).where(and(eq(interestTodos.interestKey, interestKey), eq(interestTodos.title, t.title)));
      if (ex) {
        const m = /scope: (.*)\. Re-check/.exec(ex.detail);
        const mine = /scope: (.*)\. Re-check/.exec(t.detail);
        if (m && mine) {
          const have = m[1].split('; ');
          const addn = mine[1].split('; ').filter((n) => !have.includes(n));
          if (addn.length) {
            const detail = ex.detail.replace(m[1], [...have, ...addn].join('; '));
            await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: ex.id, action: 'update', before: ex, after: { ...ex, detail }, write: (tx) => tx.update(interestTodos).set({ detail, updatedAt: new Date() }).where(eq(interestTodos.id, ex.id)).returning() });
            updated++;
            continue;
          }
        }
        skipped++;
        continue;
      }
      const values = { interestKey, ...t, source: SOURCE, doneAt: null };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
      created++;
    }
  }
  console.log('ideas added', ideasAdded, '| to-dos created', created, 'updated', updated, 'skipped', skipped);
  process.exit(0);
})();
