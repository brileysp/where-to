'use client';

import { usePendingEdits } from './PendingEditsProvider';

export function ToastHost() {
  const { toasts } = usePendingEdits();
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div className={`toast ${t.kind}`} key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
