'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { QuestionRow } from '@/lib/admin/interest-pages/types';
import type { LinkReviewInterest } from '@/lib/db/queries/question-links';
import { QuestionChipGrid } from '@/components/admin/interest-page/QuestionChipGrid';
import { acceptSuggestedLinks } from '@/app/admin/destinations/interests/[key]/question-actions';
import '@/components/admin/interest-page/interest-page.css';
import '@/components/admin/matching/matching.css';

/**
 * Only the questions where a chip link is proposed, across every interest, so they can be reviewed in one sitting. Each section is the same grid
 * as on the interest page (click a dashed cell to accept it, a solid one to remove it). Rows stay on the page after they are accepted.
 */
export function QuestionLinksReview({ initial }: { initial: LinkReviewInterest[] }) {
  const [byInterest, setByInterest] = useState<Record<string, QuestionRow[]>>(() => Object.fromEntries(initial.map((i) => [i.key, i.questions])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Object.values(byInterest).reduce((n, qs) => n + qs.reduce((m, q) => m + q.suggestedChips.length, 0), 0);
  const questionCount = initial.reduce((n, i) => n + i.questions.length, 0);

  async function acceptEverything() {
    setBusy(true); setError(null);
    for (const i of initial) {
      const r = await acceptSuggestedLinks(i.key, null);
      if (!r.ok) { setError(r.message); setBusy(false); return; }
      setByInterest((all) => ({ ...all, [i.key]: all[i.key].map((q) => ({ ...q, whenChips: [...q.whenChips, ...q.suggestedChips].sort(), suggestedChips: [] })) }));
    }
    setBusy(false);
  }

  return (
    <div className="mt-wrap">
      <div className="mt-card">
        <h2>Suggested question links</h2>
        <p className="mt-muted" style={{ margin: '0 0 6px' }}>
          Only the {questionCount} question{questionCount === 1 ? '' : 's'} where a chip is proposed to open the question, across every interest. A proposed link changes nothing until you
          accept it. Accepting leaves a question&rsquo;s approval alone. A dashed &ldquo;?&rdquo; is a proposal; click it to accept. A solid dot is already a link; click it to remove it.
        </p>
        <div className="ip-legend" style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 10px' }}>
          <span><span className="ip-gdot sug" aria-hidden="true">?</span> proposed: click to accept</span>
          <span><span className="ip-gdot on" aria-hidden="true">✓</span> already a link: click to remove</span>
          <span>Empty circle: no link. Click to add one.</span>
        </div>
        <div className="mt-toolbar" style={{ marginTop: 0 }}>
          <span className="ip-chip warn">{remaining} still to review</span>
          <button className="btn" disabled={busy || remaining === 0} onClick={acceptEverything}>Accept all {remaining} suggested</button>
          {error && <span className="mt-err">{error}</span>}
        </div>
      </div>
      {initial.length === 0 && <div className="mt-card"><p className="mt-muted" style={{ margin: 0 }}>Nothing is waiting. Every proposed link has been accepted or dismissed.</p></div>}
      {initial.map((i) => (
        <section key={i.key}>
          <h3 style={{ margin: '4px 0 0', display: 'flex', gap: 10, alignItems: 'baseline' }}>
            {i.label}
            <Link href={`/admin/destinations/interests/${i.key}`} className="ip-faint" style={{ fontSize: 12, fontWeight: 400 }}>open the interest</Link>
          </h3>
          <QuestionChipGrid
            interestKey={i.key}
            chips={i.chips}
            questions={byInterest[i.key]}
            setQuestions={(f) => setByInterest((all) => ({ ...all, [i.key]: f(all[i.key]) }))}
            compact
          />
        </section>
      ))}
    </div>
  );
}
