'use client';

import type { InterestPageData } from '@/lib/admin/interest-pages/types';
import { StaleChecklist } from './StaleChecklist';

/** The reasons this interest's data goes stale, on the interest page under the Planning card. */
export function StalenessCard({ data }: { data: InterestPageData }) {
  return (
    <div className="ip-card" id="stale">
      <StaleChecklist interestKey={data.key} evergreen={data.planning.evergreen} />
    </div>
  );
}
