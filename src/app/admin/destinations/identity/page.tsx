import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin/auth';
import { db } from '@/lib/db/client';
import { placeIdentity } from '@/lib/db/schema';
import { staleScopeRows } from '@/lib/places/scope-stale';
import { confirmPlaceScope } from '../identity-actions';

const note = { padding: '8px 12px', borderRadius: 6, marginBottom: 12 } as const;

export default async function IdentityListPage({ searchParams }: { searchParams: Promise<{ status?: string; saved?: string; error?: string }> }) {
  await requireAdminUser();
  const { status, saved, error } = await searchParams;
  const all = (await db.select().from(placeIdentity)).sort((a, b) => a.label.localeCompare(b.label));
  const draft = all.filter((r) => r.scopeStatus === 'draft').length;
  const stale = new Map<string, number>(); for (const x of await staleScopeRows()) stale.set(x.key, (stale.get(x.key) ?? 0) + x.count);
  const rows = status === 'draft' || status === 'confirmed' ? all.filter((r) => r.scopeStatus === status) : all;
  return (
    <main style={{ maxWidth: 1100, margin: '30px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Names &amp; scope</h1>
      <p style={{ color: '#555', fontSize: 14, maxWidth: 760 }}>What each place is called, what its web address is, and what area it covers. The level and the named places (anchors) start as drafts. Open a place to correct them, or press Confirm if the draft is right as it stands. {all.length - draft} of {all.length} are confirmed.</p>
      {saved && <p style={{ ...note, color: '#2f7d46', background: '#e2f1e6' }}>{saved}</p>}
      {error && <p style={{ ...note, color: '#a63a2a', background: '#f8e3df' }}>{error}</p>}
      <p style={{ fontSize: 14, display: 'flex', gap: 16 }}>
        <Link href="/admin/destinations/identity">All ({all.length})</Link>
        <Link href="/admin/destinations/identity?status=draft">Drafts ({draft})</Link>
        <Link href="/admin/destinations/identity?status=confirmed">Confirmed ({all.length - draft})</Link>
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}><th style={{ padding: '6px 8px' }}>Place</th><th>Web address</th><th>Level</th><th>Covers</th><th>Scope version</th><th>Made for an older scope</th><th>Scope</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderBottom: '1px solid #eee', background: r.scopeStatus === 'draft' ? undefined : '#f4faf5' }}>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}><Link href={`/admin/destinations/${r.slug}/identity`}>{r.label}</Link></td>
              <td style={{ color: '#666' }}>{r.slug}</td>
              <td>{r.level.replace('_', '-')}</td>
              <td>{r.anchors.join('; ')}</td>
              <td>{r.scopeVersion}</td>
              <td style={{ color: stale.get(r.key) ? '#a06a00' : '#999' }}>{stale.get(r.key) ? `${stale.get(r.key)} rows` : '–'}</td>
              <td>{r.scopeStatus === 'draft' ? 'Draft' : 'Confirmed'}</td>
              <td>
                <Link href={`/admin/destinations/${r.slug}/identity`} style={{ marginRight: 10 }}>Edit</Link>
                {r.scopeStatus === 'draft' && <form action={confirmPlaceScope} style={{ display: 'inline' }}><input type="hidden" name="key" value={r.key} /><input type="hidden" name="status" value={status ?? ''} /><button type="submit" style={{ cursor: 'pointer' }}>Confirm</button></form>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
