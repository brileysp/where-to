'use client';

import { usePendingEdits } from './PendingEditsProvider';

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function SaveReviewModal({ onClose }: { onClose: () => void }) {
  const { pending, saveAll, saving } = usePendingEdits();

  async function handleConfirm() {
    await saveAll();
    onClose();
  }

  return (
    <div className="modal-scrim open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2>
            Review {pending.length} change{pending.length === 1 ? '' : 's'} before saving
          </h2>
          <p>
            Each write goes through the same validated, audit-logged path as the existing admin forms — every
            change below gets a &quot;before&quot; snapshot you can restore later.
          </p>
        </div>
        <div className="modal-body">
          {pending.map((p) => (
            <div className="diff-row" key={p.id}>
              <div className="diff-loc">
                <b>{p.entityLabel}</b> · {p.fieldLabel}
              </div>
              <div className="diff-vals">
                <span className="pi-old">{truncate(p.oldValueLabel, 20)}</span> →{' '}
                <span className="pi-new">{truncate(p.newValueLabel, 20)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving…' : `Save ${pending.length} change${pending.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
