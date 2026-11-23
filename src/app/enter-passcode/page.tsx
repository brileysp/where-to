import { submitPasscode } from './actions';

/** Styled like the app (owner, 22 Nov 2026): the same background, card, rounded field and terracotta button, big enough to type on a phone. */
export default async function EnterPasscodePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '72px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 380, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">🧭</div>
        <h1 style={{ fontSize: 28, margin: '6px 0 6px', letterSpacing: '-0.01em' }}>Where To?</h1>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', margin: '0 0 24px' }}>This preview is password-protected.</p>
        <form action={submitPasscode} style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 18 }}>
          <input type="hidden" name="next" value={next && next.startsWith('/') ? next : '/'} />
          <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Passcode
            <input
              type="password"
              name="passcode"
              required
              autoFocus
              autoComplete="off"
              placeholder="Enter passcode"
              aria-invalid={!!error}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '14px 14px', fontSize: 16, color: 'var(--text)', background: 'var(--bg)', border: `1.5px solid ${error ? 'var(--bad)' : 'var(--border)'}`, borderRadius: 12 }}
            />
          </label>
          {error && (
            <p role="alert" style={{ color: 'var(--bad)', fontSize: 14, margin: 0 }}>That passcode did not work. Try again.</p>
          )}
          <button type="submit" style={{ padding: '14px 16px', fontSize: 16, fontWeight: 700, color: '#1b1209', background: 'var(--accent)', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
            Enter
          </button>
        </form>
      </div>
    </main>
  );
}
