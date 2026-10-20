import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAllDnaCards, getAllDomainDefs, getAllDimensionDefs, getAllTensionDefs } from '@/lib/db/queries/dna-content';
import { OnboardingFlow } from '@/components/dna/OnboardingFlow';

export default async function DnaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The switch for the new onboarding flow (docs/onboarding-v2/SPEC.md): with ONBOARDING_V2=1 the old flow's address sends visitors to the new one.
  if (process.env.ONBOARDING_V2 === '1') {
    const params = await searchParams;
    redirect(params.entry === 'review' ? '/onboarding-v2?review=1' : '/onboarding-v2');
  }
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
