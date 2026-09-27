import { submitPasscode } from './actions';

export default async function EnterPasscodePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif', padding: '0 16px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Where To?</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>This preview is password-protected.</p>
      <form action={submitPasscode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="hidden" name="next" value={next && next.startsWith('/') ? next : '/'} />
        <label>
          Passcode
          <input
            type="password"
            name="passcode"
            required
            autoFocus
            autoComplete="off"
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        {error && (
          <p style={{ color: '#b00020', fontSize: 14, margin: 0 }}>That passcode isn&apos;t right — try again.</p>
        )}
        <button type="submit" style={{ padding: '8px 16px', marginTop: 8, cursor: 'pointer' }}>
          Enter
        </button>
      </form>
    </main>
  );
}
