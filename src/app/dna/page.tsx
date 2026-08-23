import { Suspense } from 'react';
import { getAllDnaCards, getAllDomainDefs, getAllDimensionDefs, getAllTensionDefs } from '@/lib/db/queries/dna-content';
import { OnboardingFlow } from '@/components/dna/OnboardingFlow';

export default async function DnaPage() {
  const [cards, domains, dimensions, tensions] = await Promise.all([
    getAllDnaCards(),
    getAllDomainDefs(),
    getAllDimensionDefs(),
    getAllTensionDefs(),
  ]);

  return (
    <Suspense>
      <OnboardingFlow cards={cards} domains={domains} dimensions={dimensions} tensions={tensions} />
    </Suspense>
  );
}
