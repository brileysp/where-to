'use client';

/** Show a pasted link as a short clickable "link" instead of a long raw address. */
export function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>open link ↗</a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
