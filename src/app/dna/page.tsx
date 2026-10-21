import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAllDnaCards, getAllDomainDefs, getAllDimensionDefs, getAllTensionDefs } from '@/lib/db/queries/dna-content';
import { OnboardingFlow } from '@/components/dna/OnboardingFlow';
import { loadFeatures } from '@/lib/featuresServer';
import { onboardingV2On } from '@/lib/features';

export const dynamic = 'force-dynamic';

export default async function DnaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The switch for the new onboarding flow (docs/onboarding-v2/SPEC.md): when it is on in the database (see lib/features.ts) the old flow's address sends visitors to the new one.
  if (onboardingV2On(await loadFeatures())) {
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
