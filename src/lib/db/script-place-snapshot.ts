import { places } from './schema';

/**
 * 4 Nov 2026: one-off scripts (not the running app) read the whole places table dozens of times a day with
 * `db.select().from(places)`: about 13 MB each over the wire. About 290 scripts do it, and it used up the free plan's
 * 5 GB of egress. When PLACE_ROWS_SNAPSHOT is set (scripts only; the app never sets it) a plain, unfiltered
 * `db.select().from(places)` is answered from the disk copy instead, after the cheap updatedAt check that downloads
 * only rows that changed (see primary-place-rows.ts). Anything with a column list, where, limit, order or join goes to
 * the database as before. Set PLACE_ROWS_FRESH=1 to skip this and read the table directly.
 */
/** True only in a one-off script started as `tsx scripts/<name>.ts` with PLACE_ROWS_SNAPSHOT set. `npm run dev` sets the same flag (for its place-row disk copy), so the flag alone must not switch this on in the dev server. */
export function isSnapshotScript(): boolean {
  return Boolean(process.env.PLACE_ROWS_SNAPSHOT) && !process.env.PLACE_ROWS_FRESH && /(^|[\\/])scripts[\\/]/.test(process.argv[1] ?? '');
}

export function withPlaceSnapshot<T extends object>(base: T): T {
  if (!isSnapshotScript()) return base;
  const load = async () => {
    const { getPrimaryPlaceRows } = await import('./queries/primary-place-rows');
    return [...(await getPrimaryPlaceRows())]; // a copy, so a script that sorts or edits its array cannot change the cache
  };
  const fromProxy = (fb: any, touched: boolean): any =>
    new Proxy(fb, {
      get(t, p, r) {
        const v = Reflect.get(t, p, r);
        if (p === 'then') return touched ? v.bind(t) : (res: any, rej: any) => load().then(res, rej);
        if (p === 'catch') return touched ? v.bind(t) : (rej: any) => load().catch(rej);
        if (p === 'finally') return touched ? v.bind(t) : (fn: any) => load().finally(fn);
        if (typeof v !== 'function') return v;
        return (...a: any[]) => {
          const out = v.apply(t, a);
          return out === t || (out && typeof out === 'object' && typeof out.then === 'function') ? fromProxy(out, true) : out;
        };
      },
    });
  const selectProxy = (sb: any): any =>
    new Proxy(sb, {
      get(t, p, r) {
        const v = Reflect.get(t, p, r);
        if (p !== 'from' || typeof v !== 'function') return v;
        return (table: unknown, ...rest: unknown[]) => {
          const fb = v.call(t, table, ...rest);
          return table === places ? fromProxy(fb, false) : fb;
        };
      },
    });
  return new Proxy(base, {
    get(t, p, r) {
      const v = Reflect.get(t, p, r);
      if (p !== 'select' || typeof v !== 'function') return v;
      return (...args: unknown[]) => {
        const sb = v.apply(t, args);
        return args.length ? sb : selectProxy(sb);
      };
    },
  });
}
