import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin/auth';
import { listCardsForAdmin, listDomainKeysForAdmin } from '@/lib/db/queries/admin-cards';
import { CardsTable } from '@/components/admin/CardsTable';

export default async function AdminCardsPage() {
  await requireAdminUser();
  const [cards, domainOptions] = await Promise.all([listCardsForAdmin(), listDomainKeysForAdmin()]);

  return (
    <main style={{ maxWidth: 1200, margin: '48px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22 }}>Cards ({cards.length})</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/admin">← Admin home</Link>
          <Link href="/admin/dna">Domains &amp; insights</Link>
          <Link href="/admin/cards/new">+ New card</Link>
        </div>
      </div>
      <p style={{ color: '#555', fontSize: 13, marginTop: -8 }}>Most fields can be changed right here and save straight away. Click an id for the full form (description, signals, image prompt).</p>
      <CardsTable
        domainOptions={domainOptions}
        initialRows={cards.map((c) => ({
          id: c.id,
          short: c.short,
          title: c.title,
          category: c.category,
          stage: c.stage,
          domainKey: c.domainKey,
          niche: c.niche,
          tags: c.tags,
          unlockMinPositive: c.unlockMinPositive,
          unlockMinLove: c.unlockMinLove,
          updatedAt: c.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
