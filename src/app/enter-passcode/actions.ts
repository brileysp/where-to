'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PASSCODE_COOKIE } from '@/proxy';

// A path to bounce back to after a correct passcode — never anything but a
// same-site path, so this can't be turned into an open redirect.
function safeNextPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : '';
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export async function submitPasscode(formData: FormData) {
  const entered = String(formData.get('passcode') ?? '');
  const next = safeNextPath(formData.get('next'));
  const sitePasscode = process.env.SITE_PASSCODE;

  if (!sitePasscode || entered !== sitePasscode) {
    redirect(`/enter-passcode?next=${encodeURIComponent(next)}&error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(PASSCODE_COOKIE, sitePasscode, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days — a returning tester shouldn't have to retype this every visit.
  });

  redirect(next);
}
