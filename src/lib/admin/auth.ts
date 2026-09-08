import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Every visitor already gets a real Supabase Auth session the instant they
 * load any page — anonymous, via src/proxy.ts. This doesn't add a separate
 * credential system on top of that; it narrows the existing session down to
 * the one specific, non-anonymous account allowed to act as admin. Once real
 * user sign-up exists (a documented future phase), this same check is what
 * keeps an ordinary signed-up visitor from ever satisfying it — only the
 * exact ADMIN_EMAIL match does.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous || !user.email || user.email !== adminEmail) return null;
  return { id: user.id, email: user.email };
}

/**
 * Call at the top of every admin page and every admin Server Action — never
 * rely on a proxy.ts redirect alone. Next's own guidance: a proxy matcher
 * change or refactor can silently stop covering a Server Action, so
 * authorization must be verified inside each one directly.
 */
export async function requireAdminUser(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect('/admin/login');
  return user;
}
