import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { requireAdminUser } from '@/lib/admin/auth';
import { db } from '@/lib/db/client';
import { domains, subdimensions, dimensions, tensions } from '@/lib/db/schema';
import { DNA_TABLES } from '@/lib/admin/dna-config';
import { DnaTables, type DnaRow } from '@/components/admin/DnaTables';

export default async function AdminDnaPage() {
  await requireAdminUser();
  const [d, s, dm, t] = await Promise.all([
    db.select().from(domains).orderBy(asc(domains.key)),
    db.select().from(subdimensions).orderBy(asc(subdimensions.domainKey), asc(subdimensions.ordinal)),
    db.select().from(dimensions).orderBy(asc(dimensions.id)),
    db.select().from(tensions).orderBy(asc(tensions.id)),
  ]);
  const toRow = (idShown: string, id: string, v: object): DnaRow => ({ id, idShown, values: v as Record<string, unknown> });
  const data = {
    domains: d.map((r) => toRow(r.key, r.key, r)),
    subdimensions: s.map((r) => toRow(r.domainKey, r.id, r)),
    dimensions: dm.map((r) => toRow(r.id, r.id, r)),
    tensions: t.map((r) => toRow(r.id, r.id, r)),
  };
  void DNA_TABLES;
  return (
    <main style={{ maxWidth: 1300, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
        <Link href="/admin">← Admin home</Link>
        <Link href="/admin/cards">Cards</Link>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Domains &amp; insights</h1>
      <DnaTables data={data} />
    </main>
  );
}
