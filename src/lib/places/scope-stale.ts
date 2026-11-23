// 18 Nov 2026 (step 6 of docs/place-naming-plan.md): lists data that was made for a different scope than the place has now. Every row in place_hotel_quote_runs, place_interest_facts and
// content_generations records the place's scope version when it was written (a database trigger fills it in), and place_identity.scope_version goes up when a place is widened or
// narrowed. A row with a lower version than its place was made for the old area: it is listed here, never deleted or rewritten. Hotel runs count only when they are the current run.
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export interface StaleScopeRow { key: string; label: string; what: string; count: number; oldestVersion: number; placeVersion: number }

export async function staleScopeRows(ex: Pick<typeof db, 'execute'> = db): Promise<StaleScopeRow[]> {
  const r: any = await ex.execute(sql`
    select i.key, i.label, 'hotel samples' as what, count(*)::int as n, min(r.scope_version)::int as oldest, i.scope_version as pv
      from place_hotel_quote_runs r join place_identity i on i.key = r.place_id where r.is_current and r.scope_version < i.scope_version group by i.key, i.label, i.scope_version
    union all
    select i.key, i.label, 'interest facts', count(*)::int, min(f.scope_version)::int, i.scope_version
      from place_interest_facts f join place_identity i on i.key = f.place_id where f.scope_version < i.scope_version group by i.key, i.label, i.scope_version
    union all
    select i.key, i.label, 'authored texts and scores (generations)', count(*)::int, min(g.scope_version)::int, i.scope_version
      from content_generations g join place_identity i on i.key = g.place_id where g.scope_version < i.scope_version group by i.key, i.label, i.scope_version
    order by 2, 3`);
  return ((r.rows ?? r) as any[]).map((x) => ({ key: x.key, label: x.label, what: x.what, count: Number(x.n), oldestVersion: Number(x.oldest), placeVersion: Number(x.pv) }));
}

/** One plain sentence for a report line. */
export function describeStale(r: StaleScopeRow): string {
  return `${r.what}: ${r.count} made for scope version ${r.oldestVersion}, the place is now version ${r.placeVersion}`;
}
