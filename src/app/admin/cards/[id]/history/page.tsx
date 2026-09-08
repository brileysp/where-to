import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCardForAdmin } from '@/lib/db/queries/admin-cards';
import { listAuditHistory } from '@/lib/db/queries/admin-audit';
import { AuditHistoryList } from '@/components/admin/AuditHistoryList';
import { restoreCardVersion } from '../../actions';

export default async function CardHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const { error } = await searchParams;

  const card = await getCardForAdmin(id);
  if (!card) notFound();

  const entries = await listAuditHistory('card', id);
  const restoreThisCard = restoreCardVersion.bind(null, id);

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
        <Link href="/admin/cards">← Cards</Link>
        <Link href={`/admin/cards/${id}`}>Edit</Link>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{card.title} — history</h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Every save through the admin UI, newest first.</p>
      {error && <p style={{ color: '#b00020', fontSize: 14, marginBottom: 16 }}>Couldn&apos;t restore that version — please try again.</p>}
      <AuditHistoryList
        entries={entries.map((e) => ({
          id: e.id,
          action: e.action,
          createdAt: e.createdAt,
          before: e.beforeValue as Record<string, unknown> | null,
          after: e.afterValue as Record<string, unknown> | null,
        }))}
        restoreAction={restoreThisCard}
      />
    </main>
  );
}
