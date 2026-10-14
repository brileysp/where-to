'use client';

import { Fragment, useState } from 'react';
import type { AuthoringPassRow } from '@/lib/admin/interest-pages/types';
import { AUTHORING_PASS_KINDS } from '@/lib/db/schema';
import { savePass, setPassFinished } from '@/app/admin/destinations/interests/[key]/actions';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const num = (n: number) => n.toLocaleString('en-US');
const usd = (n: number) => `$${n.toFixed(n < 10 ? 3 : 2)}`;
const today = () => new Date().toISOString().slice(0, 10);

export function AuthoringSection({ interestKey, passes, setPasses }: { interestKey: string; passes: AuthoringPassRow[]; setPasses: (f: (p: AuthoringPassRow[]) => AuthoringPassRow[]) => void }) {
  const [open, setOpen] = useState<string | null>(passes[0]?.id ?? null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ label: '', kind: 'redo', notes: '', promptVersion: '' });
  const [finishDate, setFinishDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (id: string, p: Partial<AuthoringPassRow>) => setPasses((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function save(id: string) {
    setBusy(true); setError(null);
    const r = await savePass(interestKey, id, { ...draft, promptVersion: draft.promptVersion.trim() || null });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    patch(id, { label: r.label, kind: r.kind as AuthoringPassRow['kind'], notes: r.notes, promptVersion: r.promptVersion || null });
    setEditing(null);
  }
  async function finish(id: string, on: string | null) {
    setBusy(true); setError(null);
    const r = await setPassFinished(interestKey, id, on);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    patch(id, { finishedAt: r.finishedAt });
  }

  if (passes.length === 0) return <div className="ip-section"><div className="ip-card ip-faint">No Gemini authoring has been recorded for this interest yet.</div></div>;

  const total = passes.reduce((a, p) => ({ tokens: a.tokens + p.tokensIn + p.tokensOut, cost: a.cost + p.costUsd }), { tokens: 0, cost: 0 });
  return (
    <div className="ip-section">
      <div className="ip-toolbar">
        <span className="ip-muted">Every Gemini authoring pass for this interest, newest first. Tokens are input and output; output includes Gemini&apos;s hidden reasoning.</span>
        <span className="grow" />
        {error && <span className="ip-err">{error}</span>}
        <span className="ip-faint">All passes: {num(total.tokens)} tokens, {usd(total.cost)}</span>
      </div>
      <div className="ip-table-wrap">
        <table className="ip-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Pass</th>
              <th style={{ textAlign: 'left' }}>Finished</th>
              <th>Places</th>
              <th style={{ textAlign: 'left' }}>Prompt</th>
              <th style={{ textAlign: 'right' }}>Tokens in</th>
              <th style={{ textAlign: 'right' }}>Tokens out</th>
              <th style={{ textAlign: 'right' }}>Total tokens</th>
              <th style={{ textAlign: 'right' }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {passes.map((p) => (
              <Fragment key={p.id}>
                <tr onClick={() => setOpen(open === p.id ? null : p.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <b>{open === p.id ? '▾' : '▸'} {p.label}</b> <span className={`ip-chip ${p.kind === 'initial' ? 'info' : p.kind === 'pilot' ? 'dim' : 'good'}`}>{p.kind}</span>
                  </td>
                  <td>{p.finishedAt ? fmtDate(p.finishedAt) : <span className="ip-chip warn">in progress · last run {fmtDate(p.lastActivityAt)}</span>}</td>
                  <td style={{ textAlign: 'center' }}>{p.places}</td>
                  <td className="ip-mono">{p.promptVersion ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{num(p.tokensIn)}</td>
                  <td style={{ textAlign: 'right' }}>{num(p.tokensOut)}</td>
                  <td style={{ textAlign: 'right' }}><b>{num(p.tokensIn + p.tokensOut)}</b></td>
                  <td style={{ textAlign: 'right' }}>{usd(p.costUsd)}</td>
                </tr>
                {open === p.id && (
                  <tr>
                    <td colSpan={8} style={{ background: 'var(--bg-sunken)', padding: '10px 14px' }}>
                      <div className="ip-toolbar" style={{ marginBottom: 8 }}>
                        {editing === p.id ? (
                          <>
                            <input className="ip-forminput" aria-label="Pass name" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} style={{ minWidth: 260 }} />
                            <select className="ip-formselect" aria-label="Kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                              {AUTHORING_PASS_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                            <input className="ip-forminput" aria-label="Prompt version" placeholder="Prompt, e.g. birding/v8" value={draft.promptVersion} onChange={(e) => setDraft({ ...draft, promptVersion: e.target.value })} style={{ minWidth: 190 }} />
                            <input className="ip-forminput" aria-label="Notes" placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} style={{ minWidth: 260 }} />
                            <button className="btn btn-primary" disabled={busy} onClick={() => save(p.id)}>Save</button>
                            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <span className="ip-muted">{p.notes || 'No notes.'}</span>
                            <span className="grow" />
                            <button className="btn" onClick={() => { setDraft({ label: p.label, kind: p.kind, notes: p.notes, promptVersion: p.promptVersion ?? '' }); setEditing(p.id); }}>Edit name, kind, prompt, notes</button>
                            {p.finishedAt ? (
                              <button className="btn" disabled={busy} onClick={() => finish(p.id, null)}>Reopen</button>
                            ) : (
                              <>
                                <input type="date" className="ip-forminput" aria-label="Finished on" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} />
                                <button className="btn btn-primary" disabled={busy} onClick={() => finish(p.id, finishDate)}>Mark finished</button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <table className="ip-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Batch run</th>
                            <th>Places</th>
                            <th>Valid</th>
                            <th>Invalid</th>
                            <th>Not applicable</th>
                            <th>Applied</th>
                            <th style={{ textAlign: 'left' }}>Model · thinking</th>
                            <th style={{ textAlign: 'right' }}>Tokens in</th>
                            <th style={{ textAlign: 'right' }}>Tokens out</th>
                            <th style={{ textAlign: 'right' }}>Total tokens</th>
                            <th style={{ textAlign: 'right' }}>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.batches.map((b) => (
                            <tr key={b.id}>
                              <td>{fmtTime(b.startedAt)}{b.finishedAt ? '' : ' (no end recorded)'}</td>
                              <td style={{ textAlign: 'center' }}>{b.places}</td>
                              <td style={{ textAlign: 'center' }}>{b.valid}</td>
                              <td style={{ textAlign: 'center' }}>{b.invalid || ''}</td>
                              <td style={{ textAlign: 'center' }}>{b.notApplicable || ''}</td>
                              <td style={{ textAlign: 'center' }}>{b.applied || ''}</td>
                              <td className="ip-mono">{b.model ?? '—'}{b.thinkingLevel ? ` · ${b.thinkingLevel}` : ''}</td>
                              <td style={{ textAlign: 'right' }}>{num(b.tokensIn)}</td>
                              <td style={{ textAlign: 'right' }}>{num(b.tokensOut)}</td>
                              <td style={{ textAlign: 'right' }}>{num(b.tokensIn + b.tokensOut)}</td>
                              <td style={{ textAlign: 'right' }}>{usd(b.costUsd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
