import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCardForAdmin, listDomainKeysForAdmin } from '@/lib/db/queries/admin-cards';
import { CardForm } from '@/components/admin/CardForm';
import { updateCard } from '../actions';

export default async function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;

  const [card, domainOptions] = await Promise.all([getCardForAdmin(id), listDomainKeysForAdmin()]);
  if (!card) notFound();

  const updateThisCard = updateCard.bind(null, id);

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
        <Link href="/admin/cards">← Cards</Link>
        <Link href={`/admin/cards/${id}/history`}>History</Link>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Edit card</h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>Last saved {card.updatedAt.toLocaleString()}.</p>
      <CardForm
        action={updateThisCard}
        initialValues={{
          id: card.id,
          short: card.short,
          title: card.title,
          description: card.description,
          category: card.category,
          tags: card.tags,
          imagePrompt: card.imagePrompt,
          preferenceSignals: card.preferenceSignals,
          dimensionSignals: card.dimensionSignals,
          stage: card.stage,
          domainKey: card.domainKey,
          niche: card.niche,
          cardSubdimensions: card.cardSubdimensions,
          sampleDestinations: card.sampleDestinations,
          unlockMinPositive: card.unlockMinPositive,
          unlockMinLove: card.unlockMinLove,
          diagnosticPurpose: card.diagnosticPurpose,
        }}
        mode="edit"
        domainOptions={domainOptions}
      />
    </main>
  );
}
