// 28 Oct 2026: pulls per-interest status counts from the live database for the Interest Completeness artifact. Usage: npx tsx scripts/interest-completeness.ts (writes /tmp/interest-completeness.json)
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { sql } = await import('drizzle-orm');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const keys = SLIDERS.map((s) => s.key);
  const rows = (r: unknown) => ((r as { rows?: unknown[] }).rows ?? r) as Record<string, unknown>[];
  const arr = sql.raw(`ARRAY[${keys.map((k) => `'${k}'`).join(',')}]::text[]`);
  const places = rows(await db.execute(sql`
    select k as key,
      count(*) filter (where not (k = any(p.na_sliders))) as applicable,
      count(*) filter (where k = any(p.na_sliders)) as na,
      count(*) filter (where k = any(p.na_sliders) and coalesce(length(p.na_reasons->k->>'reason'),0) > 0) as na_reason,
      count(*) filter (where not (k = any(p.na_sliders)) and p.base_scores ? k) as scored,
      count(*) filter (where not (k = any(p.na_sliders)) and k = any(p.authored_curves)) as curve,
      count(*) filter (where not (k = any(p.na_sliders)) and coalesce(length(p.slider_overview->>k),0) > 0) as text,
      count(*) filter (where not (k = any(p.na_sliders)) and coalesce(jsonb_array_length(case when jsonb_typeof(p.slider_monthly_weather->k)='array' then p.slider_monthly_weather->k else '[]'::jsonb end),0) > 0) as months,
      count(*) filter (where not (k = any(p.na_sliders)) and p.slider_overview_meta->k->>'origin' = 'gemini') as gemini
    from places p cross join unnest(${arr}) as k group by k`));
  const facts = rows(await db.execute(sql`select place_id, interest_key, facts - 'evidence' as facts from place_interest_facts`));
  const chips = rows(await db.execute(sql`select interest_key, count(*) as total, count(*) filter (where approved_at is not null) as approved, count(*) filter (where status='live') as live from interest_chips group by interest_key`));
  const qs = rows(await db.execute(sql`select interest_key, count(*) as total, count(*) filter (where approved_at is not null) as approved, count(*) filter (where fit_rule is not null) as mapped from interest_questions group by interest_key`));
  const todos = rows(await db.execute(sql`select interest_key, count(*) filter (where status <> 'done') as open, count(*) filter (where status = 'needs_you') as needs_you from interest_todos group by interest_key`));
  const reviews = rows(await db.execute(sql`select interest_key, count(*) filter (where coalesce(reviewer_role,'') !~* '^AI' and reviewer_name !~* '(claude|gemini)') as human, count(*) filter (where coalesce(reviewer_role,'') ~* '^AI' or reviewer_name ~* '(claude|gemini)') as ai, count(distinct reviewer_name) filter (where coalesce(reviewer_role,'') !~* '^AI' and reviewer_name !~* '(claude|gemini)') as human_names from interest_reviews group by interest_key`));
  const passes = rows(await db.execute(sql`select interest_key, count(*) as total, count(*) filter (where finished_at is not null) as finished, max(prompt_version) as pv from authoring_passes group by interest_key`));
  const fc = rows(await db.execute(sql`select interest_key, count(*) as total, count(*) filter (where verdict in ('verified','owner_accepted')) as ok, count(*) filter (where verdict='unchecked') as unchecked, count(*) filter (where verdict='wrong') as wrong from content_fact_checks group by interest_key`));
  const gens = rows(await db.execute(sql`select interest_key, count(*) filter (where validation_status='applied') as applied, count(distinct place_id) filter (where validation_status='applied') as applied_places from content_generations group by interest_key`));
  const anchors = rows(await db.execute(sql`select interest_key from interest_anchor_overrides`));
  const rules = rows(await db.execute(sql`select interest_key, count(*) as n from interest_rule_sections group by interest_key`));
  const by = <T extends Record<string, unknown>>(a: T[], f = 'interest_key') => new Map(a.map((r) => [String(r[f]), r]));
  const P = by(places, 'key'), C = by(chips), Q = by(qs), T = by(todos), R = by(reviews), A = by(passes), F = by(fc), G = by(gens), RU = by(rules);
  const n = (v: unknown) => Number(v ?? 0);
  const factRows = new Map<string, Array<Record<string, unknown>>>();
  for (const r of facts) { const k = String(r.interest_key); (factRows.get(k) ?? factRows.set(k, []).get(k)!).push(r); }
  const out = SLIDERS.filter((s) => !(s as { hidden?: boolean }).hidden).map((s) => {
    const p = P.get(s.key) ?? {}; const applicable = n(p.applicable);
    const defs = factDefsFor(s.key).filter((d) => !d.hidden && !['evidence', 'drawSourceChecked'].includes(d.key) && d.group !== 'draw');
    const hasDef = defs.length > 0;
    const naSet = new Set<string>();
    const fr = factRows.get(s.key) ?? [];
    let placesFilled = 0, cells = 0, filled = 0, checked = 0;
    for (const r of fr) {
      const f = (r.facts ?? {}) as Record<string, unknown>;
      if (f.drawSourceChecked === true) checked++;
      const got = defs.filter((d) => { const v = f[d.key]; return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0); }).length;
      cells += defs.length; filled += got; if (defs.length && (got / defs.length >= 0.25 || f.drawSourceChecked === true)) placesFilled++;
    }
    return {
      key: s.key, label: s.label, icon: s.icon, group: s.group, tier: s.audienceTier,
      applicable, na: n(p.na), naReason: n(p.na_reason), scored: n(p.scored), curve: n(p.curve), text: n(p.text), months: n(p.months), gemini: n(p.gemini),
      defs: defs.length, factRows: fr.length, placesFilled, cellFill: cells ? filled / cells : 0, checked,
      chips: n(C.get(s.key)?.total), chipsApproved: n(C.get(s.key)?.approved), chipsLive: n(C.get(s.key)?.live),
      qs: n(Q.get(s.key)?.total), qsApproved: n(Q.get(s.key)?.approved), qsMapped: n(Q.get(s.key)?.mapped),
      todosOpen: n(T.get(s.key)?.open), needsYou: n(T.get(s.key)?.needs_you),
      reviewsHuman: n(R.get(s.key)?.human), reviewsAi: n(R.get(s.key)?.ai), humanNames: n(R.get(s.key)?.human_names),
      passes: n(A.get(s.key)?.total), passesFinished: n(A.get(s.key)?.finished), promptVersion: String(A.get(s.key)?.pv ?? ''),
      fcTotal: n(F.get(s.key)?.total), fcOk: n(F.get(s.key)?.ok), fcUnchecked: n(F.get(s.key)?.unchecked), fcWrong: n(F.get(s.key)?.wrong),
      applied: n(G.get(s.key)?.applied_places), ruleSections: n(RU.get(s.key)?.n),
      anchorOverride: anchors.some((a) => a.interest_key === s.key),
    };
  });
  writeFileSync('/tmp/interest-completeness.json', JSON.stringify(out, null, 1));
  console.log(out.length, 'interests');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
