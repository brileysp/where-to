import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin/auth';
import { signOutAdmin } from './actions';

export default async function AdminHomePage() {
  const admin = await requireAdminUser();

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 22 }}>Admin</h1>
        <form action={signOutAdmin}>
          <button type="submit" style={{ padding: '6px 12px', cursor: 'pointer' }}>
            Sign out
          </button>
        </form>
      </div>
      <p style={{ color: '#555' }}>Signed in as {admin.email}.</p>
      <ul style={{ marginTop: 24, lineHeight: 2 }}>
        <li>
          <Link href="/admin/destinations">Places</Link> — core identity, cost, climate, and bands, one row per destination.
        </li>
        <li>
          <Link href="/admin/destinations/matrix">Interests × Places</Link> — base score, tier, N/A, and the real
          seasonal min/max/swing per destination × slider — useful for spotting flat or undifferentiated sliders.
        </li>
        <li>
          <Link href="/admin/destinations/cost-items">Cost Items</Link> — itemized costs per destination, with a
          &quot;Copy for Sheets&quot; export.
        </li>
        <li>
          <Link href="/admin/destinations/interests">Interests</Link> — per-slider emoji overrides.
        </li>
        <li>
          <Link href="/admin/destinations/seasonal-flags">Seasonal Flags</Link> — which months are dry/wet/hot/cold/
          peak/low and other seasonal flags, per destination.
        </li>
        <li>
          <Link href="/admin/cards">Cards</Link> — Travel DNA experience cards.
        </li>
      </ul>
    </main>
  );
}
