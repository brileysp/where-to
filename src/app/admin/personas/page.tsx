import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin/auth';
import { db } from '@/lib/db/client';
import { personaOverrides } from '@/lib/db/schema';
import { PERSONAS, SLIDERS } from '@/lib/scoring/constants';
import { builtInPersona } from '@/lib/scoring/overrides';
import { PersonasEditor, type PersonaView } from '@/components/admin/PersonasEditor';

export default async function AdminPersonasPage() {
  await requireAdminUser();
  const rows = await db.select({ id: personaOverrides.personaId }).from(personaOverrides);
  const editedIds = new Set(rows.map((r) => r.id));
  const personas: PersonaView[] = PERSONAS.map((p) => {
    const base = builtInPersona(p.id)!;
    return { id: p.id, name: p.name, icon: p.icon, blurb: p.blurb, primary: p.primary, weights: p.weights, builtIn: base, edited: editedIds.has(p.id) };
  });
  return (
    <main style={{ maxWidth: 1100, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}><Link href="/admin">← Admin home</Link></div>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Personas</h1>
      <p style={{ color: '#555', fontSize: 13, maxWidth: 780 }}>The starting sets of interest weights a traveller can pick. Edits are saved over the built-in personas and apply to the traveller app on its next load; the built-in values stay in the code and come back with &quot;Back to built-in persona&quot;.</p>
      <PersonasEditor personas={personas} interests={SLIDERS.filter((s) => !s.hidden).map((s) => ({ key: s.key, label: s.label, icon: s.icon, group: s.group }))} />
    </main>
  );
}
