'use client';

import { useMemo, useState } from 'react';
import type { InterestPageData, InterestPlaceRow } from '@/lib/admin/interest-pages/types';
import type { InterestPlanningNotes } from '@/lib/db/schema';
import { PlanningScoreCell } from '../PlanningCells';
import { useFieldEdit } from '../useFieldEdit';
import { useUpdatedAtSync } from '../useUpdatedAtSync';
import { PLANNING_KEYS, PLANNING_LABELS, SEASONAL_TREATMENT, seasonalBand, reviewCadence, CADENCE_LABEL, placeSwingFlags, SWING_EXCEPTION_POINTS, type PlanningKey } from '@/lib/scoring/planning';
import { daysUntil, todayIso } from '@/lib/admin/todo-dates';

type Planning = InterestPageData['planning'];
type NoteKey = Exclude<keyof InterestPlanningNotes, 'approved' | 'proposedBy'>;

const WHY_KEY: Record<PlanningKey, NoteKey> = { seasonalVariance: 'seasonalWhy', evergreen: 'staleFirst', stakes: 'stakesWhy', refreshEffort: 'refreshWhy' };
const WHY_LABEL: Record<PlanningKey, string> = { seasonalVariance: 'Why', evergreen: 'Goes stale first', stakes: 'Why', refreshEffort: 'Why' };
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The four planning scores for one interest, what they mean for the work, and the places whose seasons break the interest's pattern. */
export function PlanningCard({ data, places }: { data: InterestPageData; places: InterestPlaceRow[] }) {
  const [p, setP] = useState<Planning>(data.planning);
  const commit = useFieldEdit();
  useUpdatedAtSync('interest', (entityId, updatedAt) => { if (entityId === data.key) setP((x) => ({ ...x, updatedAt })); });
  const flags = useMemo(() => placeSwingFlags(places), [places]);
  const exceptions = useMemo(() => [...flags.entries()].filter(([, f]) => f.exception).sort((a, b) => Math.abs(b[1].diff) - Math.abs(a[1].diff)), [flags]);
  const nameOf = (id: string) => places.find((x) => x.id === id)?.name ?? id;

  function saveNotes(next: InterestPlanningNotes, what: string) {
    commit<InterestPlanningNotes>({
      entityType: 'interest', entityId: data.key, entityLabel: data.label, field: 'planningNotes', fieldLabel: 'Planning notes',
      loadedUpdatedAt: p.updatedAt, oldValue: p.notes, newValue: next, setLocal: (v) => setP((x) => ({ ...x, notes: v })), toLabel: () => what,
    });
  }
  const approve = (k: PlanningKey) =>
    saveNotes({ ...p.notes, approved: { ...(p.notes.approved ?? {}), [k]: { by: 'Admin', at: todayIso(), via: 'Interest page' } } }, `${PLANNING_LABELS[k].label} approved`);

  const sv = p.seasonalVariance, ev = p.evergreen;
  const days = p.nextReviewOn ? daysUntil(p.nextReviewOn, todayIso()) : null;

  return (
    <div className="ip-card ip-plan">
      <div className="ip-plan-head">
        <b>Planning</b>
        <span className="ip-faint">How much seasonal writing, how often to review, how careful to be, and how much time a refresh takes. Never shown to travellers.</span>
      </div>
      <div className="ip-plan-grid">
        {PLANNING_KEYS.map((k) => {
          const approved = p.notes.approved?.[k];
          const why = p.notes[WHY_KEY[k]] ?? '';
          return (
            <div className="ip-plan-cell" key={k}>
              <div className="ip-plan-label" title={PLANNING_LABELS[k].help}>{PLANNING_LABELS[k].label}</div>
              <PlanningScoreCell entityKey={data.key} entityLabel={data.label} loadedUpdatedAt={p.updatedAt} field={k} value={p[k]} setLocal={(v) => setP((x) => ({ ...x, [k]: v }))} />
              <div className="ip-faint ip-plan-status">
                {approved ? <>Approved by {approved.by}, {fmtDate(approved.at)}</> : p[k] === null ? 'Not set' : <>Proposed{p.notes.proposedBy ? ` by ${p.notes.proposedBy}` : ''} <button type="button" className="ip-linkbtn" onClick={() => approve(k)}>Approve</button></>}
              </div>
              <PlanNote label={WHY_LABEL[k]} value={why} onSave={(t) => saveNotes({ ...p.notes, [WHY_KEY[k]]: t }, `${PLANNING_LABELS[k].label}: ${WHY_LABEL[k].toLowerCase()} edited`)} />
            </div>
          );
        })}
      </div>
      <div className="ip-plan-foot">
        {sv !== null && <div><b>Seasonal writing:</b> {seasonalBand(sv)}. {SEASONAL_TREATMENT[seasonalBand(sv)]}</div>}
        {ev !== null && (
          <div>
            <b>Review cadence:</b> {CADENCE_LABEL[reviewCadence(ev)]}.{' '}
            {p.nextReviewOn ? <>Next review {fmtDate(p.nextReviewOn)}{days !== null && days < 0 ? <span className="ip-chip bad" style={{ marginLeft: 6 }}>overdue</span> : <span className="ip-faint"> ({days === 0 ? 'today' : `in ${days} days`})</span>}. The To do tab holds it.</> : 'No review is scheduled yet.'}
          </div>
        )}
        <PlanNote label="Check early when" value={p.notes.reviewTrigger ?? ''} onSave={(t) => saveNotes({ ...p.notes, reviewTrigger: t }, 'Check-early note edited')} />
        <div>
          <b>Places that break the pattern:</b>{' '}
          {flags.size === 0 ? <span className="ip-faint">too few places with monthly scores to compare.</span> : exceptions.length === 0 ? <span className="ip-faint">none. Every place swings within {SWING_EXCEPTION_POINTS} points of the usual {[...flags.values()][0].norm.toFixed(1)}.</span> : (
            <>
              <span className="ip-faint">swing differs by {SWING_EXCEPTION_POINTS}+ points from the usual {[...flags.values()][0].norm.toFixed(1)} ({exceptions.length} of {flags.size}). </span>
              {exceptions.slice(0, 10).map(([id, f]) => <span key={id} className="ip-chip warn" style={{ marginRight: 4 }} title={`Swing ${f.swing.toFixed(1)} points against the usual ${f.norm.toFixed(1)}`}>{nameOf(id)} {f.diff > 0 ? '+' : ''}{f.diff.toFixed(1)}</span>)}
              {exceptions.length > 10 && <span className="ip-faint">and {exceptions.length - 10} more (see the Swing column below)</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanNote({ label, value, onSave }: { label: string; value: string; onSave: (text: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="ip-plan-note">
      <span>{label}</span>
      <textarea value={draft} rows={2} maxLength={800} onChange={(e) => setDraft(e.target.value)} onBlur={() => { const t = draft.trim(); if (t !== value) onSave(t); }} />
    </label>
  );
}
