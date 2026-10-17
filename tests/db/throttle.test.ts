/* eslint-disable @typescript-eslint/no-explicit-any */import { describe, expect, it } from 'vitest';
import { throttleClient } from '@/lib/db/throttle';

/** A stand-in for the postgres client that records how many queries are running at once. */
function fakeClient() {
  const state = { running: 0, peak: 0, sent: 0 };
  const query = (text: string, rows: unknown[]) => {
    state.sent++;
    state.running++;
    state.peak = Math.max(state.peak, state.running);
    const done = new Promise<unknown[]>((resolve) => setTimeout(() => { state.running--; resolve(rows); }, 5));
    return Object.assign(done, { values: () => done.then((r) => r.map((x) => [x])) });
  };
  const client = {
    options: { parsers: {} },
    unsafe: (text: string) => query(text, [{ text }]),
    begin: async (fn: (tx: unknown) => Promise<unknown>) => { state.running++; state.peak = Math.max(state.peak, state.running); try { return await fn({ unsafe: (t: string) => query(t, [{ t }]) }); } finally { state.running--; } },
  };
  return { client, state };
}

describe('throttleClient', () => {
  it('never has more queries running than the limit, and answers every one', async () => {
    const { client, state } = fakeClient();
    const t = throttleClient(client, 3);
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => t.unsafe(`q${i}`)));
    expect(results).toHaveLength(40);
    expect(results[7]).toEqual([{ text: 'q7' }]);
    expect(state.peak).toBeLessThanOrEqual(3);
    expect(state.sent).toBe(40);
  });

  it('does not send a query until it is awaited, and sends it once', async () => {
    const { client, state } = fakeClient();
    const t = throttleClient(client, 2);
    const pending = t.unsafe('later');
    expect(state.sent).toBe(0);
    await pending;
    await pending;
    expect(state.sent).toBe(1);
  });

  it('supports .values() the way drizzle uses it', async () => {
    const { client } = fakeClient();
    const t = throttleClient(client, 2);
    expect(await (t.unsafe('v') as unknown as { values: () => Promise<unknown> }).values()).toEqual([[{ text: 'v' }]]);
  });

  it('holds one slot for a whole transaction and passes its connection through', async () => {
    const events: string[] = [];
    const wait = () => new Promise((r) => setTimeout(r, 5));
    const client = {
      unsafe: async (text: string) => { events.push(`start ${text}`); await wait(); events.push(`end ${text}`); return [text]; },
      begin: async (fn: (tx: any) => Promise<unknown>) => fn({ unsafe: async (text: string) => { events.push(`start ${text}`); await wait(); events.push(`end ${text}`); return [text]; } }),
    };
    const t = throttleClient(client, 1);
    const tx = t.begin(async (c: { unsafe: (q: string) => Promise<unknown> }) => { await c.unsafe('a'); await c.unsafe('b'); return 'done'; });
    const other = t.unsafe('outside');
    expect(await tx).toBe('done');
    await other;
    expect(events).toEqual(['start a', 'end a', 'start b', 'end b', 'start outside', 'end outside']);
  });

  it('frees the slot when a query fails', async () => {
    const { client } = fakeClient();
    let n = 0;
    const flaky = { ...client, unsafe: (text: string) => (n++ === 0 ? Promise.reject(new Error('boom')) : client.unsafe(text)) };
    const t = throttleClient(flaky, 1);
    await expect(Promise.resolve(t.unsafe('x'))).rejects.toThrow('boom');
    expect(await t.unsafe('y')).toEqual([{ text: 'y' }]);
  });

  it('passes other properties through untouched', () => {
    const { client } = fakeClient();
    expect(throttleClient(client, 2).options).toBe(client.options);
  });
});
