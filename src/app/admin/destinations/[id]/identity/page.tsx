import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireAdminUser } from '@/lib/admin/auth';
import { db } from '@/lib/db/client';
import { placeIdentity, placeLabelHistory, placeSlugRedirects } from '@/lib/db/schema';
import { resolveAdminPlace } from '@/lib/places/admin-route';
import { SCOPE_LEVELS } from '@/lib/places/identity';
import { changePlaceSlug, renamePlace, savePlaceScope } from '../../identity-actions';

const field = { display: 'block', width: '100%', padding: '6px 8px', marginTop: 4, fontSize: 14, boxSizing: 'border-box' } as const;
const lab = { display: 'block', marginBottom: 12, fontSize: 14 } as const;
const card = { border: '1px solid #ddd', borderRadius: 8, padding: '14px 16px', marginBottom: 18 } as const;
const msg = { padding: '8px 12px', borderRadius: 6, marginBottom: 12 } as const;

export default async function PlaceIdentityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdminUser();
  const { id: param } = await params; const { saved, error } = await searchParams;
  const q = saved ? `?saved=${encodeURIComponent(saved)}` : error ? `?error=${encodeURIComponent(error)}` : '';
  const { key } = await resolveAdminPlace(param, '/identity', q);
  const [i] = await db.select().from(placeIdentity).where(eq(placeIdentity.key, key));
  const labels = (await db.select().from(placeLabelHistory).where(eq(placeLabelHistory.placeKey, key))).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.createdAt.getTime() - a.createdAt.getTime());
  const old = await db.select().from(placeSlugRedirects).where(eq(placeSlugRedirects.placeKey, key));
  return (
    <main style={{ maxWidth: 780, margin: '30px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ display: 'flex', gap: 16, fontSize: 14 }}><Link href="/admin/destinations/identity">← Names &amp; scope</Link><Link href={`/admin/destinations/${i.slug}/profile`}>Place profile</Link><Link href={`/admin/destinations/${i.slug}/history`}>Edit history</Link></p>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{i.label}</h1>
      {saved && <p style={{ ...msg, color: '#2f7d46', background: '#e2f1e6' }}>{saved}</p>}
      {error && <p style={{ ...msg, color: '#a63a2a', background: '#f8e3df' }}>{error}</p>}

      <section style={card}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>Name</h2>
        <p style={{ fontSize: 13, color: '#555' }}>What the traveler and the reports call this place. Renaming changes nothing else: scores, texts and notes stay with the place. The old name is kept in the history below.</p>
        <form action={renamePlace}>
          <input type="hidden" name="key" value={i.key} /><input type="hidden" name="slug" value={i.slug} />
          <label style={lab}>New name<input name="label" required defaultValue={i.label} maxLength={120} style={field} /></label>
          <label style={lab}>Why (optional, for the history)<input name="reason" placeholder="widened to the whole country" style={field} /></label>
          <label style={{ ...lab, display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="alsoSlug" /> Also move the web address to match the new name (the old address keeps working)</label>
          <button type="submit" style={{ padding: '6px 14px', cursor: 'pointer' }}>Rename</button>
        </form>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Names this place has had</h3>
        <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>{labels.map((h) => <li key={h.id}><b>{h.label}</b>{h.isCurrent ? ' (now)' : h.retiredNote ? `, until ${h.retiredNote}` : ''}{h.reason ? ` — ${h.reason}` : ''}</li>)}</ul>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>Web address</h2>
        <p style={{ fontSize: 13, color: '#555' }}>Now <b>{i.slug}</b>. Old addresses keep working{old.length ? `: ${old.map((o) => o.slug).sort().join(', ')}` : ''}.</p>
        <form action={changePlaceSlug} style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <input type="hidden" name="key" value={i.key} /><input type="hidden" name="slug" value={i.slug} />
          <label style={{ ...lab, flex: 1, marginBottom: 0 }}>New address<input name="newSlug" required defaultValue={i.slug} style={field} /></label>
          <button type="submit" style={{ padding: '6px 14px', cursor: 'pointer' }}>Change</button>
        </form>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>Scope <span style={{ fontSize: 13, fontWeight: 400, color: i.scopeStatus === 'draft' ? '#a06a00' : '#2f7d46' }}>({i.scopeStatus === 'draft' ? 'draft' : 'confirmed'}, version {i.scopeVersion})</span></h2>
        <p style={{ fontSize: 13, color: '#555' }}>What area this place covers. Texts, scores and hotel samples record which version they were made under, so widening or narrowing the place shows what needs redoing.</p>
        <form action={savePlaceScope}>
          <input type="hidden" name="key" value={i.key} /><input type="hidden" name="slug" value={i.slug} />
          <label style={lab}>Level<select name="level" defaultValue={i.level} style={field}>{SCOPE_LEVELS.map((l) => <option key={l} value={l}>{l.replace('_', '-')}</option>)}</select></label>
          <label style={lab}>Places it covers (one per line)<textarea name="anchors" rows={5} defaultValue={i.anchors.join('\n')} style={field} /></label>
          <label style={lab}>Note (optional)<input name="note" defaultValue={i.scopeNote} style={field} /></label>
          <label style={{ ...lab, display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="changesCoverage" /> This changes what the place covers (widened or narrowed): add 1 to the version</label>
          <button type="submit" name="intent" value="confirm" style={{ padding: '6px 14px', cursor: 'pointer', marginRight: 8 }}>Save and confirm</button>
          <button type="submit" name="intent" value="draft" style={{ padding: '6px 14px', cursor: 'pointer' }}>Save as draft</button>
        </form>
      </section>
    </main>
  );
}
