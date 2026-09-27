export interface AuditEntry {
  id: string;
  action: string;
  createdAt: Date;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

function diffKeys(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed.sort();
}

/**
 * Shared by every entity's /history page. Restoring a row writes its
 * `after` snapshot back — "make it look like it did right after this
 * save" — through the exact same withAdminAudit path a normal edit uses,
 * so restoring appends a new history entry rather than rewriting the past
 * (see docs/admin-panel-plan.md, "Undo / restore"). The newest entry
 * (already the live state) has no restore button — restoring it would be
 * a no-op.
 */
export function AuditHistoryList({
  entries,
  restoreAction,
}: {
  entries: AuditEntry[];
  restoreAction: (auditId: string, formData: FormData) => Promise<void>;
}) {
  if (entries.length === 0) {
    return <p style={{ color: '#888' }}>No history yet — nothing has been saved through the admin UI for this record.</p>;
  }

  return (
    <div>
      {entries.map((entry, i) => {
        const changed = diffKeys(entry.before, entry.after);
        const restoreThis = restoreAction.bind(null, entry.id);
        return (
          <div key={entry.id} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span>
                <strong>{entry.action}</strong> · {entry.createdAt.toLocaleString()}
              </span>
              {i === 0 ? (
                <span style={{ color: '#888', fontSize: 12 }}>current version</span>
              ) : (
                <form action={restoreThis}>
                  <button type="submit" style={{ padding: '4px 10px', cursor: 'pointer' }}>
                    Restore this version
                  </button>
                </form>
              )}
            </div>
            <p style={{ fontSize: 12, color: '#555', margin: '6px 0 0' }}>
              {changed.length ? `changed: ${changed.join(', ')}` : 'no field changes recorded'}
            </p>
            <details style={{ marginTop: 6 }}>
              <summary style={{ fontSize: 12, color: '#888', cursor: 'pointer' }}>show full snapshot</summary>
              <pre style={{ fontSize: 11, background: '#f7f7f7', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
                {JSON.stringify(entry.after, null, 2)}
              </pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}
