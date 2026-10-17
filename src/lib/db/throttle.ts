/**
 * Keeps the number of queries in flight at or below the size of the connection pool.
 *
 * Why: Supabase's pooler (port 6543, transaction mode) stops answering for good when a burst of queued queries piles up on a few connections.
 * Measured 17 Oct 2026 with nothing else running: 16 queries at once on a pool of 8 were fine, 20 never finished, and neither did 5 on a pool of 1;
 * the same 60 queries passed through a cap equal to the pool size finished in under a second. The new onboarding page runs about ten queries per
 * visit, so two visitors at once froze the whole server until it was restarted. Waiting here, in our own queue, costs nothing; waiting inside the pooler hangs.
 *
 * Drizzle only calls `unsafe(...)` (awaited, or followed by `.values()`) and `begin(...)` on the client, so those are the two calls held back.
 * Inside a transaction the callback gets the transaction's own connection, which is not throttled again: the transaction holds one slot for its whole length.
 */
type AnyFn = (...args: any[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function throttleClient<T extends object>(client: T, limit: number): T {
  let active = 0;
  const waiting: Array<() => void> = [];
  const acquire = (): Promise<void> => {
    if (active < limit) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => waiting.push(resolve));
  };
  // A released slot goes straight to the next waiter, so `active` stays put in that case.
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
  const run = async <R>(start: () => PromiseLike<R>): Promise<R> => {
    await acquire();
    try {
      return await start();
    } finally {
      release();
    }
  };
  // Something awaitable that sends the query only when awaited, once, and only after a slot is free.
  const lazy = <R>(start: () => PromiseLike<R>) => {
    let result: Promise<R> | undefined;
    const go = () => (result ??= run(start));
    return {
      then: <A, B>(onOk?: (v: R) => A | PromiseLike<A>, onErr?: (e: unknown) => B | PromiseLike<B>) => go().then(onOk, onErr),
      catch: <B>(onErr?: (e: unknown) => B | PromiseLike<B>) => go().catch(onErr),
      finally: (f?: () => void) => go().finally(f),
    };
  };
  return new Proxy(client, {
    get(target, prop, receiver) {
      const real = target as unknown as Record<string | symbol, AnyFn>;
      if (prop === 'unsafe') {
        return (...args: unknown[]) => {
          const send = () => real.unsafe(...args);
          return Object.assign(lazy(send), { values: () => lazy(() => send().values()) });
        };
      }
      if (prop === 'begin') return (...args: unknown[]) => run(() => real.begin(...args));
      return Reflect.get(target, prop, receiver);
    },
  });
}
