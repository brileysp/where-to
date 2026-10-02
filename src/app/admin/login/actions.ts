'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAllowedAdminEmail } from '@/lib/admin/allowed-admins';

export async function signInAdmin(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  // Reject before ever calling Supabase if this isn't even an allowed
  // email — avoids an unnecessary auth round-trip for the wrong account.
  if (!isAllowedAdminEmail(email)) {
    redirect('/admin/login?error=1');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/admin/login?error=1');

  redirect('/admin');
}
