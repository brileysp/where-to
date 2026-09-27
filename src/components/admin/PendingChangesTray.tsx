'use client';

import { createContext, useContext, useState } from 'react';
import { usePendingEdits } from './PendingEditsProvider';
import { SaveReviewModal } from './SaveReviewModal';

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const TrayCollapsedContext = createContext<{ collapsed: boolean; setCollapsed: (c: boolean) => void } | null>(null);

/** Wraps the topbar toggle button + body panel so they share collapsed state without lifting it into the page layout. */
export function TrayCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  return <TrayCollapsedContext.Provider value={{ collapsed, setCollapsed }}>{children}</TrayCollapsedContext.Provider>;
}

function useTrayCollapsed() {
  const ctx = useContext(TrayCollapsedContext);
  if (!ctx) throw new Error('useTrayCollapsed must be used inside TrayCollapseProvider');
  return ctx;
}

/** Small toggle button — belongs in the topbar. */
export function PendingTrayToggle() {
  const { pending } = usePendingEdits();
  const { collapsed, setCollapsed } = useTrayCollapsed();
  return (
    <button className="btn pending-btn" onClick={() => setCollapsed(!collapsed)}>
      Pending {pending.length > 0 && <span className="pending-count">{pending.length}</span>}
    </button>
  );
}

/** The sliding panel itself — belongs as a flex sibling of page content. */
export function PendingTrayPanel() {
  const { pending, undoEdit, discardAll } = usePendingEdits();
  const { collapsed } = useTrayCollapsed();
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <>
      <div className={`tray${collapsed ? ' collapsed' : ''}`}>
        <div className="tray-head">
          <h3>Pending changes</h3>
          <p>Nothing writes until you review and save.</p>
        </div>
        <div className="tray-list">
          {pending.length === 0 ? (
            <div className="tray-empty">
              No unsaved edits.
              <br />
              Changes you make in any grid appear here for review before anything writes to the database.
            </div>
          ) : (
            pending.map((p) => (
              <div className="pending-item" key={p.id}>
                <div className="pi-top">
                  <div>
                    <div className="pi-where">{p.entityLabel}</div>
                    <div className="pi-field">{p.fieldLabel}</div>
                  </div>
                  <button className="pi-undo" title="Undo this edit" onClick={() => undoEdit(p.id)}>
                    ↺
                  </button>
                </div>
                <div className="pi-diff">
                  <span className="pi-old">{truncate(p.oldValueLabel, 28)}</span> →{' '}
                  <span className="pi-new">{truncate(p.newValueLabel, 28)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="tray-foot">
          <button className="btn" onClick={discardAll} disabled={pending.length === 0}>
            Discard all
          </button>
          <button className="btn btn-primary" disabled={pending.length === 0} onClick={() => setReviewOpen(true)}>
            Review &amp; save
          </button>
        </div>
      </div>
      {reviewOpen && <SaveReviewModal onClose={() => setReviewOpen(false)} />}
    </>
  );
}
