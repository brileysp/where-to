import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { renderToString } from 'react-dom/server';
import path from 'node:path';
import * as schema from '@/lib/db/schema';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({ get db() { return h.db; } }));
vi.mock('@/lib/admin/auth', () => ({ requireAdminUser: async () => ({ id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com' }) }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); },
  notFound: () => { throw new Error('NOT_FOUND'); },
  usePathname: () => '/admin/destinations/identity',
}));
vi.mock('next/link', async () => { const { createElement } = await import('react'); return { default: ({ href, children }: { href: string; children: unknown }) => createElement('a', { href }, children as never) }; });

// 18 Nov 2026, step 5: the two "Names & scope" screens render with real data, and an address that is not the current slug redirects to it.
describe('Names & scope screens', () => {
  beforeAll(async () => {
    const db = drizzle(new PGlite(), { schema }); h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    const { insertNewPlace } = await import('@/lib/admin/create-place');
    await insertNewPlace({ id: '00000000-0000-0000-0000-000000000001', email: 'x' } as never, { name: 'Myanmar', region: 'Myanmar', climate: 'tropical' });
    await insertNewPlace({ id: '00000000-0000-0000-0000-000000000001', email: 'x' } as never, { name: 'Cuba', region: 'Caribbean', climate: 'tropical' });
    await db.insert(schema.placeIdRedirects).values({ oldId: 'bagan', placeKey: 'p0001', note: 'test' });
    await db.insert(schema.placeSlugRedirects).values({ slug: 'bagan', placeKey: 'p0001', kind: 'old_id' });
  }, 60_000);

  it('lists every place with its label, address, level and scope status', async () => {
    const { default: Page } = await import('@/app/admin/destinations/identity/page');
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) })).replace(/<!-- -->/g, '');
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]*>/g, ' ');
    expect(html).toContain('Myanmar'); expect(html).toContain('Cuba'); expect(html).toContain('Draft'); expect(html).toContain('0 of 2 are confirmed');
    expect(visible).not.toMatch(/p000[12]/); // the owner sees labels, never keys (they travel only in hidden form fields)
  });

  it('shows one place with its name history, address and scope form', async () => {
    const { default: Page } = await import('@/app/admin/destinations/[id]/identity/page');
    const html = renderToString(await Page({ params: Promise.resolve({ id: 'myanmar' }), searchParams: Promise.resolve({ saved: 'Renamed.' }) })).replace(/<!-- -->/g, '');
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]*>/g, ' '); expect(visible).not.toMatch(/p000[12]/);
    expect(html).toContain('Names this place has had'); expect(html).toContain('Renamed.'); expect(html).toContain('Save and confirm'); expect(html).toContain('bagan');
  });

  it('sends an old address to the current one', async () => {
    const { default: Page } = await import('@/app/admin/destinations/[id]/identity/page');
    await expect(Page({ params: Promise.resolve({ id: 'bagan' }), searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT /admin/destinations/myanmar/identity');
    await expect(Page({ params: Promise.resolve({ id: 'atlantis' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
  });
});
