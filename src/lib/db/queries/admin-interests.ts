import { db } from '@/lib/db/client';
import { interestMeta } from '@/lib/db/schema';

export async function listInterestMetaForAdmin() {
  return db.select().from(interestMeta).orderBy(interestMeta.key);
}
