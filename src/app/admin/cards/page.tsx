import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin/auth';
import { listCardsForAdmin } from '@/lib/db/queries/admin-cards';

export default async function AdminCardsPage() {
  await requireAdminUser();
  const cards = await listCardsForAdmin();

  return (
    <main style={{ maxWidth: 900, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22 }}>Cards ({cards.length})</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/admin">← Admin home</Link>
          <Link href="/admin/cards/new">+ New card</Link>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '6px 8px' }}>id</th>
            <th style={{ padding: '6px 8px' }}>title</th>
            <th style={{ padding: '6px 8px' }}>category</th>
            <th style={{ padding: '6px 8px' }}>stage</th>
            <th style={{ padding: '6px 8px' }}>domainKey</th>
            <th style={{ padding: '6px 8px' }}>updatedAt</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>
                <Link href={`/admin/cards/${card.id}`}>{card.id}</Link>
              </td>
              <td style={{ padding: '6px 8px' }}>{card.title}</td>
              <td style={{ padding: '6px 8px' }}>{card.category}</td>
              <td style={{ padding: '6px 8px' }}>{card.stage}</td>
              <td style={{ padding: '6px 8px' }}>{card.domainKey ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: '#888' }}>{card.updatedAt.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
