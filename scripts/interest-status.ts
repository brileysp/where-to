// 9 Nov 2026: prints, for every interest Gemini has written, which steps of the definition of done (src/lib/interests/definition-of-done.ts) are missing.
// Only cheap aggregate SQL; nothing downloads the places. Usage: npx tsx scripts/interest-status.ts [--strict] [--json=/tmp/interest-status.json]
// --strict exits 1 when any interest has a gap (record-keeping gaps included); without it the exit code is always 0.
import { readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const pg = (src: string) => src.replace(/\\b/g, '\\y'); // Postgres writes the word boundary \y
let PATTERNS: Record<'filler' | 'offers' | 'promo' | 'contrast' | 'thisInterest', string>;
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  const { TEXT_RULES } = await import('../src/lib/authoring/rules');
  const rule = (id: string) => pg(TEXT_RULES.find((r) => r.id === id)!.source);
  PATTERNS = { filler: rule('filler'), offers: rule('offers'), promo: rule('promo'), contrast: rule('contrast'), thisInterest: rule('thisInterest') };
  const { db } = await import('../src/lib/db/client'); const { sql } = await import('drizzle-orm');
  const { getActiveInterests } = await import('../src/lib/scoring/active-interests'); const ACTIVE = await getActiveInterests(); const { RULES_TAB_KEYS } = await import('../src/lib/admin/interest-pages/config');
  const { evaluateInterest, summarize } = await import('../src/lib/interests/definition-of-done');
  const rows = async (s: unknown) => { const r = (await db.execute(s as never)) as unknown as { rows?: unknown[] }; return ((r.rows ?? r) as Record<string, unknown>[]); };
  const n = (v: unknown) => Number(v ?? 0);
  const keys = ACTIVE.map((s) => s.key);
  const arr = sql.raw(`ARRAY[${keys.map((k) => `'${k}'`).join(',')}]::text[]`);
  const hit = (pat: string) => `count(*) filter (where not (k = any(p.na_sliders)) and ((p.slider_overview->>k) ~* '${pat}' or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p.slider_monthly_weather->k)='array' then p.slider_monthly_weather->k else '[]'::jsonb end) t where t ~* '${pat}')))`;
  const any = `(p.slider_overview->>k) ~* '${Object.values(PATTERNS).join('|')}' or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p.slider_monthly_weather->k)='array' then p.slider_monthly_weather->k else '[]'::jsonb end) t where t ~* '${Object.values(PATTERNS).join('|')}')`;
  const places = await rows(sql`select k as key,
      count(*) filter (where not (k = any(p.na_sliders))) as applicable,
      count(*) filter (where k = any(p.na_sliders)) as na,
      count(*) filter (where k = any(p.na_sliders) and coalesce(length(p.na_reasons->k->>'reason'),0) > 0) as na_reason,
      count(*) filter (where not (k = any(p.na_sliders)) and coalesce(length(p.slider_overview->>k),0) > 0) as text,
      count(*) filter (where not (k = any(p.na_sliders)) and p.slider_overview_meta->k->>'origin' = 'gemini') as gemini,
      ${sql.raw(hit(PATTERNS.filler))} as w_filler, ${sql.raw(hit(PATTERNS.offers))} as w_offers, ${sql.raw(hit(PATTERNS.promo))} as w_promo, ${sql.raw(hit(PATTERNS.contrast))} as w_contrast, ${sql.raw(hit(PATTERNS.thisInterest))} as w_this,
      count(*) filter (where not (k = any(p.na_sliders)) and (${sql.raw(any)})) as w_total
    from places p cross join unnest(${arr}) as k group by k`);
  const passes = await rows(sql`select interest_key, count(*) as total, count(*) filter (where finished_at is not null) as finished from authoring_passes group by interest_key`);
  const fcNotes = await rows(sql`select interest_key, max(reviewed_on)::text as on_date from interest_reviews where place_id is null and notes ~* '^Fact check done' group by interest_key`);
  const humans = await rows(sql`select interest_key, count(*) as n from interest_reviews where coalesce(reviewer_role,'') !~* '^AI' and reviewer_name !~* '(claude|gemini)' group by interest_key`);
  const rules = await rows(sql`select interest_key, count(*) as n from interest_rule_sections where section_key like 'family.%' group by interest_key`);
  const chips = await rows(sql`select interest_key, count(*) as total, count(*) filter (where approved_at is not null) as approved, count(*) filter (where status='live') as live from interest_chips group by interest_key`);
  const qs = await rows(sql`select interest_key, count(*) as total, count(*) filter (where approved_at is not null) as approved from interest_questions group by interest_key`);
  const meta = await rows(sql`select key, (planning_notes->'approved') is not null as approved from interest_meta`);
  const by = (a: Record<string, unknown>[], f = 'interest_key') => new Map(a.map((r) => [String(r[f]), r]));
  const P = by(places, 'key'), A = by(passes), FN = by(fcNotes), H = by(humans), RU = by(rules), C = by(chips), Q = by(qs), M = by(meta, 'key');
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'family-scopes.json'), 'utf8')) as Record<string, { interests: Record<string, unknown> }>;
  const familyKeys = new Set(Object.values(scopes).flatMap((f) => Object.keys(f.interests)));
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const report: Array<{ key: string; label: string; family: boolean; steps: ReturnType<typeof evaluateInterest> }> = [];
  for (const s of ACTIVE) {
    const p = P.get(s.key) ?? {}; const a = A.get(s.key); const passN = n(a?.total);
    if (!(passN > 0 || n(p.gemini) > 0)) continue; // not written by Gemini yet: the whole process runs when it is
    const defs = factDefsFor(s.key).filter((d) => !d.hidden && !['evidence', 'drawSourceChecked'].includes(d.key) && d.group !== 'draw').length;
    const steps = evaluateInterest({
      key: s.key, label: s.label, family: familyKeys.has(s.key), authored: true, applicable: n(p.applicable), text: n(p.text), passes: passN, passesFinished: n(a?.finished),
      factNoteOn: String(FN.get(s.key)?.on_date ?? ''), ownerReviews: n(H.get(s.key)?.n), ruleSections: n(RU.get(s.key)?.n), handBuiltRules: RULES_TAB_KEYS.has(s.key),
      na: n(p.na), naReason: n(p.na_reason), defs, chips: n(C.get(s.key)?.total), chipsLive: n(C.get(s.key)?.live), chipsApproved: n(C.get(s.key)?.approved), questions: n(Q.get(s.key)?.total), questionsApproved: n(Q.get(s.key)?.approved),
      planningApproved: Boolean(M.get(s.key)?.approved), wording: { filler: n(p.w_filler), offers: n(p.w_offers), promo: n(p.w_promo), contrast: n(p.w_contrast), thisInterest: n(p.w_this), total: n(p.w_total) },
    });
    report.push({ key: s.key, label: s.label, family: familyKeys.has(s.key), steps });
  }
  const mark = (st: string) => (st === 'done' ? 'ok ' : st === 'gap' ? 'GAP' : st === 'info' ? 'info' : '?  ');
  const ids = report[0]?.steps.map((x) => x.id) ?? [];
  console.log(['interest'.padEnd(26), ...ids.map((i) => i.slice(0, 7).padEnd(7))].join(' '));
  for (const r of report) console.log([r.label.slice(0, 25).padEnd(26), ...r.steps.map((x) => mark(x.state).padEnd(7))].join(' '));
  console.log('');
  let gapCount = 0;
  for (const r of report) {
    const { gaps, info } = summarize(r.steps);
    if (!gaps.length && !info.length) continue;
    console.log(r.label);
    for (const g of gaps) { gapCount++; console.log(`  GAP  ${g.owner === 'owner' ? '(you) ' : ''}${g.label}: ${g.detail}`); }
    for (const g of info) console.log(`  info ${g.label}: ${g.detail}`);
  }
  console.log(`\n${report.length} interests written by Gemini; ${gapCount} gaps (not counting the owner's tracker marks, which this check cannot see yet).`);
  const out = arg('json'); if (out) writeFileSync(out, JSON.stringify(report, null, 1));
  process.exit(process.argv.includes('--strict') && gapCount > 0 ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
