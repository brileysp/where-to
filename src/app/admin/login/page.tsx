import { signInAdmin } from './actions';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Admin sign in</h1>
      <form action={signInAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        {error && (
          <p style={{ color: '#b00020', fontSize: 14, margin: 0 }}>
            Sign-in failed — check the email and password.
          </p>
        )}
        <button type="submit" style={{ padding: '8px 16px', marginTop: 8, cursor: 'pointer' }}>
          Sign in
        </button>
      </form>
    </main>
  );
}
