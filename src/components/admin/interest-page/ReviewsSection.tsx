'use client';

import { useState } from 'react';
import type { ReviewRow } from '@/lib/admin/interest-pages/types';
import { Linked } from './Linked';
import { addReview, updateReview, deleteReview } from '@/app/admin/destinations/interests/[key]/actions';

const today = () => new Date().toISOString().slice(0, 10);
interface Draft { reviewerName: string; reviewerRole: string; reviewedOn: string; placeId: string; notes: string }
const blank = (): Draft => ({ reviewerName: '', reviewerRole: '', reviewedOn: today(), placeId: '', notes: '' });

export function ReviewsSection({ interestKey, placeOptions, reviews, setReviews }: { interestKey: string; placeOptions: Array<{ id: string; name: string }>; reviews: ReviewRow[]; setReviews: (f: (r: ReviewRow[]) => ReviewRow[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string | null) => (id ? placeOptions.find((p) => p.id === id)?.name ?? id : null);
  const sort = (r: ReviewRow[]) => [...r].sort((a, b) => b.reviewedOn.localeCompare(a.reviewedOn) || b.createdAt.localeCompare(a.createdAt));
  const input = (d: Draft) => ({ placeId: d.placeId || null, reviewerName: d.reviewerName, reviewerRole: d.reviewerRole || null, reviewedOn: d.reviewedOn, notes: d.notes });

  async function create() {
    setBusy(true); setError(null);
    const r = await addReview(interestKey, input(draft));
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setReviews((all) => sort([...all, r.review]));
    setDraft(blank()); setAdding(false);
  }
  async function save(id: string, d: Draft) {
    setBusy(true); setError(null);
    const r = await updateReview(interestKey, id, input(d));
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setReviews((all) => sort(all.map((x) => (x.id === id ? r.review : x))));
    setEditing(null);
  }
  async function remove(rv: ReviewRow) {
    if (!window.confirm(`Delete the review by ${rv.reviewerName} on ${rv.reviewedOn}?`)) return;
    setBusy(true); setError(null);
    const r = await deleteReview(interestKey, rv.id);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setReviews((all) => all.filter((x) => x.id !== rv.id));
  }

  return (
    <div className="ip-section">
      <div className="ip-toolbar">
        <span className="ip-muted">Who has reviewed this interest, when, and what they did. A review can cover the whole interest or a single place.</span>
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
        <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : '+ Add review'}</button>
      </div>
      {adding && <ReviewForm d={draft} setD={setDraft} placeOptions={placeOptions} busy={busy} onSave={create} label="Save review" />}
      <div className="ip-reviews">
        {reviews.length === 0 && !adding && <div className="ip-card ip-faint">No reviews recorded yet.</div>}
        {reviews.map((rv) =>
          editing === rv.id ? (
            <EditReview key={rv.id} rv={rv} placeOptions={placeOptions} busy={busy} onCancel={() => setEditing(null)} onSave={(d) => save(rv.id, d)} />
          ) : (
            <div className="ip-card ip-review" key={rv.id}>
              <header>
                <span><span className="who">{rv.reviewerName}</span>{rv.reviewerRole && <span className="ip-muted"> · {rv.reviewerRole}</span>}</span>
                <span className="when">{rv.reviewedOn}</span>
              </header>
              <div>{rv.placeId ? <span className="ip-chip info">{nameOf(rv.placeId)}</span> : <span className="ip-chip dim">Whole interest</span>}</div>
              {rv.notes ? <p className="notes"><Linked text={rv.notes} /></p> : <p className="notes ip-faint">No notes.</p>}
              <footer>Entered by {rv.createdBy} on {rv.createdAt.slice(0, 10)} · <button className="ip-link-btn" onClick={() => setEditing(rv.id)}>Edit</button> <button className="ip-link-btn danger" onClick={() => remove(rv)}>Delete</button></footer>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function EditReview({ rv, placeOptions, busy, onCancel, onSave }: { rv: ReviewRow; placeOptions: Array<{ id: string; name: string }>; busy: boolean; onCancel: () => void; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>({ reviewerName: rv.reviewerName, reviewerRole: rv.reviewerRole ?? '', reviewedOn: rv.reviewedOn, placeId: rv.placeId ?? '', notes: rv.notes });
  return <ReviewForm d={d} setD={setD} placeOptions={placeOptions} busy={busy} onSave={() => onSave(d)} label="Save" onCancel={onCancel} />;
}

function ReviewForm({ d, setD, placeOptions, busy, onSave, label, onCancel }: { d: Draft; setD: (d: Draft) => void; placeOptions: Array<{ id: string; name: string }>; busy: boolean; onSave: () => void; label: string; onCancel?: () => void }) {
  return (
    <div className="ip-form">
      <label>Reviewer name<input value={d.reviewerName} onChange={(e) => setD({ ...d, reviewerName: e.target.value })} maxLength={120} autoFocus /></label>
      <label>Role or affiliation<input value={d.reviewerRole} onChange={(e) => setD({ ...d, reviewerRole: e.target.value })} maxLength={160} placeholder="optional, e.g. tour leader, field-guide author" /></label>
      <label>Date reviewed<input type="date" value={d.reviewedOn} onChange={(e) => setD({ ...d, reviewedOn: e.target.value })} /></label>
      <label>Covers<select value={d.placeId} onChange={(e) => setD({ ...d, placeId: e.target.value })}><option value="">Whole interest</option>{placeOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="full">Notes: what they did and found<textarea value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} maxLength={8000} style={{ minHeight: 130 }} /></label>
      <div className="btns full"><button className="btn btn-primary" disabled={busy || !d.reviewerName.trim() || !d.reviewedOn} onClick={onSave}>{label}</button>{onCancel && <button className="btn" onClick={onCancel}>Cancel</button>}</div>
    </div>
  );
}
