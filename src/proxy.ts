import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// A shared-password gate for testing in public before real accounts exist
// (Vercel's own Password Protection needs a paid plan — see docs/todo.md).
// Skipped entirely when SITE_PASSCODE isn't set, so local dev and any
// deploy that hasn't configured it are unaffected. The cookie holds the
// passcode itself rather than a separate flag: rotating SITE_PASSCODE then
// invalidates every existing visitor's cookie for free, with no extra
// bookkeeping. This is a friction gate for a small test group, not real
// security — it doesn't belong on anything actually sensitive.
export const PASSCODE_COOKIE = 'wt_passcode';

/**
 * Every visitor gets a real Supabase auth user the instant they load any
 * page — no login/signup UI (that's a deferred future phase). This is what
 * lets user_swipes/user_dna_state/etc. be user_id-scoped and RLS-protected
 * from the start, with no later "add a user_id column" migration.
 */
export async function proxy(request: NextRequest) {
  const sitePasscode = process.env.SITE_PASSCODE;
  const isPasscodeRoute = request.nextUrl.pathname.startsWith('/enter-passcode');
  if (sitePasscode && !isPasscodeRoute && request.cookies.get(PASSCODE_COOKIE)?.value !== sitePasscode) {
    const url = request.nextUrl.clone();
    url.pathname = '/enter-passcode';
    url.search = '';
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signInAnonymously();
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
