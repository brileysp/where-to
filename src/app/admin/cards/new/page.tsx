import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin/auth';
import { listDomainKeysForAdmin } from '@/lib/db/queries/admin-cards';
import { CardForm, type CardFormInitialValues } from '@/components/admin/CardForm';
import { createCard } from '../actions';

const BLANK: CardFormInitialValues = {
  id: '',
  short: '',
  title: '',
  description: '',
  category: '',
  tags: [],
  imagePrompt: null,
  preferenceSignals: {},
  dimensionSignals: {},
  stage: 'broad',
  domainKey: null,
  niche: false,
  cardSubdimensions: null,
  sampleDestinations: null,
  unlockMinPositive: null,
  unlockMinLove: null,
  diagnosticPurpose: null,
};

export default async function NewCardPage() {
  await requireAdminUser();
  const domainOptions = await listDomainKeysForAdmin();

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/cards">← Cards</Link>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>New card</h1>
      <CardForm action={createCard} initialValues={BLANK} mode="create" domainOptions={domainOptions} />
    </main>
  );
}
