import { readFileSync } from 'fs';
import { join } from 'path';
import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Shared runner for the decimalization passes (playbook Step 6, "How to decimalize").
// An interest's script supplies a Config; this file does the derivation, the checks and
// the write. Each place's existing month shape and text are kept. What changes is the
// caliber: every place gets a target peak (caliber) from a within-tier specialist
// ordering, and each month is re-derived as
//     new = old + (target - oldPeak) * (old / oldPeak)^2
// so identical old scores stay identical, the peak lands on the target, and weak months
// barely move. Results are written into scoreOverrides[key] as 12 decimals.
//
// Flags: --dry-run (print only), --redo (undo this script's previous write first, so the
// scaling always starts from the pre-pass scores), --month N (1-12, month for the printed top list).

export interface Config {
  key: string;
  /** target peak per place id; every non-NA place must appear here (or in `skip`) */
  caliber: Record<string, number>;
  /** literal-10 months per place (0-indexed): the narrowest best 1-3 months of an anchor */
  tens?: Record<string, number[]>;
  /** hand-set 12-month curves */
  custom?: Record<string, number[]>;
  /** whole-year identical text with no seasonal claim: one honest value */
  flat?: Record<string, number>;
  /** score overrides for individual months after scaling (id -> monthIdx -> score) */
  set?: Record<string, Record<number, number>>;
  /** blurb rewrites that make a split honest (id -> monthIdx -> text) */
  text?: Record<string, Record<number, string>>;
  /** places left exactly as authored */
  skip?: string[];
  /**
   * Off-season months (text matches) keep their own baseline instead of the caliber shift, via
   * `map`. Used where an interest's "outside the season" months were scoring well above zero for
   * some places (e.g. a 6 for an alpine park in January) while the blurb says nothing is in bloom.
   */
  offSeason?: { match: RegExp; map: (baseline: number) => number };
  /** cap for non-10 months; default 9.9 */
  cap?: number;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

function env(): string {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  return raw.split('\n').find((l) => l.startsWith('DATABASE_URL='))!.slice(13).replace(/^["']|["']$/g, '');
}

export async function runDecimalize(cfg: Config) {
  const KEY = cfg.key;
  const cap = cfg.cap ?? 9.9;
  const dryRun = process.argv.includes('--dry-run');
  const redo = process.argv.includes('--redo');
  const mi = process.argv.includes('--month') ? Number(process.argv[process.argv.indexOf('--month') + 1]) - 1 : 1;
  const db = drizzle(postgres(env(), { prepare: false }));

  async function original<T extends { id: string; scoreOverrides: unknown }>(r: T): Promise<T> {
    const [latest] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.entityId, r.id)).orderBy(desc(adminAuditLog.createdAt)).limit(1);
    const cur = JSON.stringify((r.scoreOverrides as any)?.[KEY] ?? null);
    const after = JSON.stringify((latest?.afterValue as any)?.scoreOverrides?.[KEY] ?? null);
    if (!latest || after !== cur) return r;
    const beforeOv = (latest.beforeValue as any)?.scoreOverrides?.[KEY];
    const so = { ...((r.scoreOverrides as Record<string, unknown>) ?? {}) };
    if (beforeOv) so[KEY] = beforeOv; else delete so[KEY];
    return { ...r, scoreOverrides: so };
  }

  const rawRows = await db.select().from(places);
  const rows = redo ? await Promise.all(rawRows.map((r) => original(r))) : rawRows;
  const current = new Map(rawRows.map((r) => [r.id, (r.scoreOverrides as any)?.[KEY] as Record<string, number> | undefined]));

  const plan: { id: string; name: string; row: (typeof rows)[number]; oldV: number[]; newV: number[] }[] = [];
  const missing: string[] = [];
  const harmonized: string[] = [];
  for (const r of rows) {
    if (((r as any).naSliders ?? []).includes(KEY)) continue;
    const oldV = scorePlace(r).monthly[KEY];
    if (!oldV) continue;
    if (cfg.skip?.includes(r.id)) continue;
    const c = cfg.caliber[r.id];
    if (c == null) { missing.push(r.id); continue; }

    // Identical blurb text must carry one score (playbook Step 6). Only tight groups are
    // merged; larger or wider groups are generic year-long baseline text whose wobble is
    // real seasonal shape, which the earlier pass deliberately left alone.
    const txt = ((r.sliderMonthlyWeather as any)?.[KEY] ?? []) as (string | null)[];
    const harm = [...oldV];
    const groups = new Map<string, number[]>();
    txt.forEach((t, i) => { if (t) { if (!groups.has(t)) groups.set(t, []); groups.get(t)!.push(i); } });
    for (const idxs of groups.values()) {
      if (idxs.length < 2) continue;
      const vals = idxs.map((i) => oldV[i]);
      const spread = Math.max(...vals) - Math.min(...vals);
      if (spread < 0.05 || idxs.length > 4 || spread > 0.55) continue;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      idxs.forEach((i) => { harm[i] = mean; });
      harmonized.push(`${r.id}: ${idxs.map((i) => MONTH_NAMES[i].slice(0, 3) + '=' + oldV[i].toFixed(2)).join(' ')} -> ${mean.toFixed(2)}`);
    }

    const P = Math.max(...harm);
    let newV: number[];
    if (cfg.custom?.[r.id]) newV = [...cfg.custom[r.id]];
    else if (cfg.flat?.[r.id] != null) newV = harm.map(() => cfg.flat![r.id]);
    else if (P <= 0) newV = [...harm];
    else newV = harm.map((x) => (x <= 0 ? 0 : Math.min(cap, Math.max(0, r1(x + (c - P) * Math.pow(x / P, 2))))));
    if (cfg.offSeason && !cfg.custom?.[r.id]) {
      txt.forEach((t, i) => { if (t && cfg.offSeason!.match.test(t)) newV[i] = r1(cfg.offSeason!.map(harm[i])); });
    }
    Object.entries(cfg.set?.[r.id] ?? {}).forEach(([i, v]) => { newV[+i] = v; });
    (cfg.tens?.[r.id] ?? []).forEach((i) => { newV[i] = 10; });
    plan.push({ id: r.id, name: r.name, row: r, oldV, newV });
  }
  if (missing.length) { console.error('No caliber for: ' + missing.join(', ')); process.exit(1); }
  const unused = Object.keys(cfg.caliber).filter((id) => !rows.some((r) => r.id === id));
  if (unused.length) console.log('caliber ids not in DB (ignored): ' + unused.join(', '));

  console.log(`\n${harmonized.length} identical-text groups harmonized:`);
  harmonized.forEach((h) => console.log('  ' + h));
  const top = [...plan].sort((a, b) => b.newV[mi] - a.newV[mi]).slice(0, 30);
  console.log(`\n${MONTH_NAMES[mi]} top 30 after:`);
  top.forEach((p, i) => console.log(String(i + 1).padStart(3), p.newV[mi].toFixed(1).padStart(4), '(was', p.oldV[mi].toFixed(2) + ')', p.name));
  const tens = plan.filter((p) => p.newV.some((x) => x >= 10));
  console.log(`\nliteral 10s: ${tens.map((p) => p.id + '[' + p.newV.filter((x) => x >= 10).length + ']').join(' ')}`);
  const differ = plan.filter((p) => { const cur = current.get(p.id); return !cur || p.newV.some((x, i) => Math.abs(x - (cur[i] ?? -1)) > 0.001); }).length;
  console.log(`${plan.length} places planned; ${differ} differ from what is currently written`);

  if (dryRun) { console.log('dry run — nothing written'); process.exit(0); }
  for (const p of plan) {
    const so = (p.row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const patch: Record<string, unknown> = { scoreOverrides: { ...so, [KEY]: Object.fromEntries(p.newV.map((s, i) => [i, s])) } };
    const t = cfg.text?.[p.id];
    if (t) {
      const cur = ((p.row.sliderMonthlyWeather as Record<string, (string | null)[]>) || {})[KEY] ?? [];
      patch.sliderMonthlyWeather = { ...(p.row.sliderMonthlyWeather as object), [KEY]: cur.map((x, i) => t[i] ?? x) };
    }
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, p.id));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: p.id,
        action: 'update', beforeValue: p.row, afterValue: { ...p.row, ...patch },
      });
    });
  }
  console.log('written');
  process.exit(0);
}
