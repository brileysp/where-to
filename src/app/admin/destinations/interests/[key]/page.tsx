import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/admin/auth';
import { getInterestPageData } from '@/lib/db/queries/interest-pages';
import { InterestPage } from '@/components/admin/interest-page/InterestPage';

export default async function AdminInterestPageRoute({ params }: { params: Promise<{ key: string }> }) {
  await requireAdminUser();
  const { key } = await params;
  const data = await getInterestPageData(key);
  if (!data) notFound();
  return <InterestPage data={data} />;
}
