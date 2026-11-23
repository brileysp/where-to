'use client';

import { STALE_SITE_KEY } from '@/lib/db/schema';
import { StaleChecklist } from './StaleChecklist';
import './interest-page.css';

/** The reasons that apply to every interest, edited once here (Interests tab); each interest's review asks them too. */
export function SiteStalenessCard() {
  return (
    <details className="ip-card" style={{ marginBottom: 12 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Reasons that apply to every interest</summary>
      <div style={{ marginTop: 10 }}><StaleChecklist interestKey={STALE_SITE_KEY} evergreen={null} /></div>
    </details>
  );
}
