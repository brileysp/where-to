import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin/auth';
import { getPrimaryPlaceRows } from '@/lib/db/queries/primary-place-rows';
import { createPlace, mergePlaces } from '../actions';

const fieldStyle = { display: 'block', width: '100%', padding: '6px 8px', marginTop: 4, fontSize: 14 } as const;
const labelStyle = { display: 'block', marginBottom: 14, fontSize: 14 } as const;
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];
const CLIMATES = ['tropical', 'desert', 'mediterranean', 'temperate', 'highland', 'polar'];

export default async function NewPlacePage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; merged?: string }> }) {
  await requireAdminUser();
  const { error, created, merged } = await searchParams;
  const rows = (await getPrimaryPlaceRows()).slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 20, display: 'flex', gap: 16 }}>
        <Link href="/admin/destinations">← Places</Link>
        <Link href="/admin/destinations?retired=1">Retired places</Link>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>New place, retire or merge</h1>
      {error && <p style={{ color: '#a63a2a', background: '#f8e3df', padding: '8px 12px', borderRadius: 6 }}>{error}</p>}
      {created && <p style={{ color: '#2f7d46', background: '#e2f1e6', padding: '8px 12px', borderRadius: 6 }}>Created {created}. It is retired and unpublished until you turn Primary and Published on, on the Places grid (Show retired places).</p>}
      {merged && <p style={{ color: '#2f7d46', background: '#e2f1e6', padding: '8px 12px', borderRadius: 6 }}>Merged {merged}.</p>}

      <h2 style={{ fontSize: 17, marginTop: 28 }}>New place</h2>
      <p style={{ color: '#555', fontSize: 13 }}>Creates an empty place. It starts retired and unpublished, so nobody sees it until you switch it on. Fill in everything else on the Places grid.</p>
      <form action={createPlace}>
        <label style={labelStyle}>Id (lowercase, hyphens, never changes)<input name="id" required placeholder="new-orleans" style={fieldStyle} /></label>
        <label style={labelStyle}>Name<input name="name" required style={fieldStyle} /></label>
        <label style={labelStyle}>Region<input name="region" required placeholder="Louisiana, USA" style={fieldStyle} /></label>
        <label style={labelStyle}>Emoji<input name="emoji" placeholder="📍" style={fieldStyle} /></label>
        <label style={labelStyle}>Climate<select name="climate" required style={fieldStyle}>{CLIMATES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label style={labelStyle}>Country code (three letters, optional)<input name="countryCode" maxLength={3} placeholder="USA" style={fieldStyle} /></label>
        <label style={labelStyle}>Continent (optional)<select name="continent" style={fieldStyle}><option value="">—</option>{CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer' }}>Create place</button>
      </form>

      <h2 style={{ fontSize: 17, marginTop: 36 }}>Retire a place</h2>
      <p style={{ color: '#555', fontSize: 13 }}>On the Places grid, untick <b>Primary (ranked)</b> to take a place out of the rankings and the admin grids, and untick <b>Published</b> to hide it from travellers. Retired places stay in the database and appear under &quot;Show retired places&quot;; tick the boxes again to restore one.</p>

      <h2 style={{ fontSize: 17, marginTop: 36 }}>Merge two places</h2>
      <p style={{ color: '#555', fontSize: 13 }}>Retires the first place and adds its name and search aliases to the second one, so searching the old name still finds the survivor. No scores or text are moved, so copy anything worth keeping first.</p>
      <form action={mergePlaces}>
        <label style={labelStyle}>Place to fold in (will be retired)<select name="sourceId" required style={fieldStyle}><option value="">—</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label style={labelStyle}>Place that stays<select name="targetId" required style={fieldStyle}><option value="">—</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer' }}>Merge</button>
      </form>
    </main>
  );
}
