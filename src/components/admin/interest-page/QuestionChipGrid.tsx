'use client';

import { useState } from 'react';
import type { ChipRow, QuestionRow } from '@/lib/admin/interest-pages/types';
import { acceptSuggestedLinks, dismissSuggestedLinks, setQuestionChipLink } from '@/app/admin/destinations/interests/[key]/question-actions';

/**
 * Every question against every chip of one interest. A solid dot means the question is asked only when that chip is ticked; a row with no dots is
 * asked of everyone who picks the interest. A dashed "?" is a link Claude proposed: it changes nothing until accepted. Click a dashed cell to accept
 * it; click a solid cell to remove it, or an empty one to add it (that changes who the question is asked of, so its approval is taken back).
 */
export function QuestionChipGrid({
  interestKey,
  chips,
  questions,
  setQuestions,
  compact = false,
}: {
  interestKey: string;
  chips: ChipRow[];
  questions: QuestionRow[];
  setQuestions: (f: (q: QuestionRow[]) => QuestionRow[]) => void;
  /** The review page: one tidy block per interest, no repeated legend or bulk buttons, and each question's answers shown under it. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [onlyProposed, setOnlyProposed] = useState(false);
  const sortedChips = [...chips].sort((a, b) => a.order - b.order);
  const sorted = [...questions].sort((a, b) => a.order - b.order).filter((q) => !onlyProposed || q.suggestedChips.length > 0);
  const suggestedTotal = questions.reduce((n, q) => n + q.suggestedChips.length, 0);
  const confirmedTotal = questions.reduce((n, q) => n + q.whenChips.length, 0);

  async function toggle(q: QuestionRow, chipKey: string) {
    const on = q.whenChips.includes(chipKey);
    setBusy(true); setError(null); setInfo(null);
    const r = await setQuestionChipLink(interestKey, q.key, chipKey, !on);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setQuestions((all) => all.map((x) => (x.key === q.key ? r.question : x)));
    if (r.approvalCleared) setInfo('That changes who the question is asked of, so its approval was taken back.');
  }
  async function accept(questionKey: string | null) {
    setBusy(true); setError(null); setInfo(null);
    const r = await acceptSuggestedLinks(interestKey, questionKey);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setQuestions((all) => all.map((x) => (questionKey && x.key !== questionKey ? x : { ...x, whenChips: [...x.whenChips, ...x.suggestedChips].sort(), suggestedChips: [] })));
  }
  async function dismiss(questionKey: string | null) {
    setBusy(true); setError(null); setInfo(null);
    const r = await dismissSuggestedLinks(interestKey, questionKey);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setQuestions((all) => all.map((x) => (questionKey && x.key !== questionKey ? x : { ...x, suggestedChips: [] })));
  }

  return (
    <div className="ip-card ip-gridcard" style={{ marginTop: 8 }}>
      <div className="ip-toolbar">
        {!compact && <b>Which chips open which question</b>}
        <span className="ip-chip new">{confirmedTotal} link{confirmedTotal === 1 ? '' : 's'}</span>
        {suggestedTotal > 0 && <span className="ip-chip warn">{suggestedTotal} suggested</span>}
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
        {info && <span className="ip-faint">{info}</span>}
        {suggestedTotal > 0 && !compact && (
          <>
            <label className="ip-ch-lab"><input type="checkbox" checked={onlyProposed} onChange={(e) => setOnlyProposed(e.target.checked)} /> Only questions with a suggestion</label>
            <button className="btn" disabled={busy} onClick={() => accept(null)}>Accept all suggested</button>
            <button className="btn" disabled={busy} onClick={() => dismiss(null)}>Dismiss all suggested</button>
          </>
        )}
      </div>
      {!compact && (
        <div className="ip-legend">
          <span><span className="ip-gdot on" aria-hidden="true">✓</span> asked only when this chip is ticked</span>
          <span><span className="ip-gdot sug" aria-hidden="true">?</span> suggested, does nothing until you accept</span>
          <span>A row with no dots is asked of everyone who picks the interest.</span>
        </div>
      )}
      <div className="ip-table-wrap">
        <table className="ip-table ip-grid">
          <thead>
            <tr>
              <th>Question</th>
              {sortedChips.map((c) => <th key={c.key} title={c.status === 'live' ? 'Live' : 'Draft'}>{c.label}<div className="ip-faint" style={{ fontWeight: 400 }}>{c.status === 'live' ? 'live' : 'draft'}</div></th>)}
              <th>Asked</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((q, i) => (
              <tr key={q.key}>
                <td className="ip-gq"><b>{i + 1}.</b> {q.text}{q.maxPicks > 1 ? ` (pick up to ${q.maxPicks})` : ''} <span className={`ip-chip ${q.kind === 'limit' ? 'warn' : 'dim'}`}>{q.kind === 'limit' ? 'Limit' : 'Lean'}</span>{compact && <span className="ip-gopts">{q.options.join(' · ')}</span>}</td>
                {sortedChips.map((c) => {
                  const on = q.whenChips.includes(c.key);
                  const sug = q.suggestedChips.includes(c.key);
                  return (
                    <td key={c.key} style={{ textAlign: 'center' }}>
                      <button
                        className={`ip-gdot ${on ? 'on' : sug ? 'sug' : ''}`}
                        disabled={busy}
                        aria-label={`${c.label}: ${on ? 'opens' : sug ? 'suggested to open' : 'does not open'} "${q.text}"`}
                        title={on ? 'Click to remove' : sug ? 'Suggested. Click to accept' : 'Click to make this chip open the question'}
                        onClick={() => void toggle(q, c.key)}
                      >{on ? '✓' : sug ? '?' : ''}</button>
                    </td>
                  );
                })}
                <td style={{ whiteSpace: 'nowrap' }}>
                  {q.whenChips.length > 0 ? <span className="ip-chip new">only when ticked</span> : <span className="ip-chip dim">always</span>}
                  {q.suggestedChips.length > 0 && (
                    <div>
                      <button className="ip-link-btn" disabled={busy} onClick={() => accept(q.key)}>Accept</button>
                      <button className="ip-link-btn danger" disabled={busy} onClick={() => dismiss(q.key)}>Dismiss</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td className="ip-faint" colSpan={sortedChips.length + 2}>No questions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
