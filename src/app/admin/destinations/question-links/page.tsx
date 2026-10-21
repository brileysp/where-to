import { getSuggestedLinkReview } from '@/lib/db/queries/question-links';
import { QuestionLinksReview } from '@/components/admin/question-links/QuestionLinksReview';

export const dynamic = 'force-dynamic';

export default async function AdminQuestionLinksPage() {
  const review = await getSuggestedLinkReview();
  return <QuestionLinksReview initial={review.interests} />;
}
