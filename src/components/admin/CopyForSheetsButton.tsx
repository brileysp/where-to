'use client';

import { useState } from 'react';

/**
 * "Copy for Sheets" + a select-manually fallback textarea, shared by every
 * admin data sheet. Pastes as a real grid into Google Sheets or an LLM
 * chat. Falls back gracefully when clipboard access is blocked (verified
 * against a sandboxed browser during development, where it reliably is).
 */
export function CopyForSheetsButton({ tsv, rowCount }: { tsv: string; rowCount: number }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [showFallback, setShowFallback] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(tsv);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('failed');
      setShowFallback(true);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <button type="button" onClick={handleCopy} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Copy for Sheets
        </button>
        {copyStatus === 'copied' && <span style={{ color: '#2e7d32', fontSize: 13 }}>Copied — paste into a spreadsheet cell.</span>}
        {copyStatus === 'failed' && <span style={{ color: '#b00020', fontSize: 13 }}>Clipboard blocked — use the fallback below.</span>}
      </div>

      <p style={{ color: '#888', fontSize: 12, margin: '0 0 8px' }}>
        {rowCount} rows.{' '}
        <button
          type="button"
          onClick={() => setShowFallback((v) => !v)}
          style={{ font: 'inherit', color: '#888', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
        >
          {showFallback ? 'hide' : 'show'} select-manually fallback
        </button>
      </p>

      {showFallback && (
        <textarea
          readOnly
          value={tsv}
          rows={8}
          onClick={(e) => e.currentTarget.select()}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, padding: 8, boxSizing: 'border-box', marginBottom: 12 }}
        />
      )}
    </div>
  );
}
