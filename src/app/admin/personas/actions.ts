'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { personaOverrides } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { PERSONAS, SLIDERS } from '@/lib/scoring/constants';
import { builtInPersona } from '@/lib/scoring/overrides';
import { invalidateOverrides, loadAndApplyOverrides } from '@/lib/scoring/overridesServer';

export type PersonaResult = { ok: true } | { ok: false; message: string };

async function write(personaId: string, change: Partial<typeof personaOverrides.$inferInsert>): Promise<PersonaResult> {
  const admin = await requireAdminUser();
  if (!PERSONAS.some((p) => p.id === personaId)) return { ok: false, message: 'Unknown persona.' };
  const [before] = await db.select().from(personaOverrides).where(eq(personaOverrides.personaId, personaId));
  const empty = { name: null, icon: null, blurb: null, primary: null, weights: {} };
  const after = { ...empty, ...(before ?? {}), ...change, personaId, updatedAt: new Date() };
  await withAdminAudit({
    actor: admin, skipPlaceCache: true, entityType: 'persona', entityId: personaId, action: before ? 'update' : 'create', before: before ?? null, after,
    write: (tx) => tx.insert(personaOverrides).values(after).onConflictDoUpdate({ target: personaOverrides.personaId, set: { ...change, updatedAt: new Date() } }),
  });
  invalidateOverrides();
  await loadAndApplyOverrides();
  return { ok: true };
}

/** Name, icon, blurb or the list of highlighted interests. Blank puts the built-in value back. */
export async function savePersonaField(personaId: string, field: 'name' | 'icon' | 'blurb' | 'primary', raw: string): Promise<PersonaResult> {
  const text = raw.trim();
  const base = builtInPersona(personaId);
  if (!base) return { ok: false, message: 'Unknown persona.' };
  if (field === 'primary') {
    const keys = text.split(',').map((k) => k.trim()).filter(Boolean);
    const bad = keys.filter((k) => !SLIDERS.some((s) => s.key === k));
    if (bad.length) return { ok: false, message: `Not an interest key: ${bad.join(', ')}` };
    if (keys.length > 12) return { ok: false, message: 'Keep it to 12 interests or fewer.' };
    return write(personaId, { primary: keys.length && JSON.stringify(keys) !== JSON.stringify(base.primary) ? keys : null });
  }
  if (text.length > (field === 'blurb' ? 300 : field === 'icon' ? 8 : 60)) return { ok: false, message: 'That is too long.' };
  return write(personaId, { [field]: text && text !== base[field] ? text : null });
}

/** One interest's weight for a persona (0 to 10). Blank puts the built-in weight back. */
export async function savePersonaWeight(personaId: string, interestKey: string, raw: string): Promise<PersonaResult> {
  const base = builtInPersona(personaId);
  if (!base) return { ok: false, message: 'Unknown persona.' };
  if (!SLIDERS.some((s) => s.key === interestKey)) return { ok: false, message: 'Unknown interest.' };
  const [row] = await db.select().from(personaOverrides).where(eq(personaOverrides.personaId, personaId));
  const weights = { ...(row?.weights ?? {}) };
  const text = raw.trim();
  if (text === '') delete weights[interestKey];
  else {
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0 || n > 10) return { ok: false, message: 'A weight is 0 to 10.' };
    if (n === (base.weights[interestKey] ?? 2)) delete weights[interestKey];
    else weights[interestKey] = Math.round(n * 2) / 2;
  }
  return write(personaId, { weights });
}

/** Drop every edit to a persona and go back to the built-in one. */
export async function resetPersona(personaId: string): Promise<PersonaResult> {
  const admin = await requireAdminUser();
  const [before] = await db.select().from(personaOverrides).where(eq(personaOverrides.personaId, personaId));
  if (!before) return { ok: true };
  await withAdminAudit({ actor: admin, skipPlaceCache: true, entityType: 'persona', entityId: personaId, action: 'delete', before, after: null, write: (tx) => tx.delete(personaOverrides).where(eq(personaOverrides.personaId, personaId)) });
  invalidateOverrides();
  await loadAndApplyOverrides();
  return { ok: true };
}
