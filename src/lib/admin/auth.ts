import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllowedAdminEmails, isAllowedAdminEmail } from './allowed-admins';

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Well-known non-human actor for Claude's own direct fixes (e.g. an expert-
 * review correction — see docs/todo.md's Gemini-pipeline standing rule),
 * passed as `applyAdminEdits`'s optional `actor` param the same way
 * src/lib/gemini/apply.ts's SYSTEM_ACTOR is for Gemini. admin_audit_log.
 * actor_id has no DB-level FK to auth.users (see schema.ts's comment on it),
 * so this is safe to insert without a real Supabase Auth user existing. A
 * distinct id/email from Gemini's SYSTEM_ACTOR on purpose — apply-edits.ts's
 * auto-stamp logic checks this exact email to know a fix came from Claude
 * rather than a real signed-in human, so content provenance can tell them
 * apart.
 */
export const CLAUDE_ACTOR: AdminUser = { id: '00000000-0000-0000-0000-000000000c1a', email: 'claude-sonnet-5@system' };

/**
 * Every visitor already gets a real Supabase Auth session the instant they
 * load any page — anonymous, via src/proxy.ts. This doesn't add a separate
 * credential system on top of that; it narrows the existing session down to
 * whichever specific, non-anonymous account is in the ADMIN_EMAILS/
 * ADMIN_EMAIL allowlist (see allowed-admins.ts). Once real user sign-up
 * exists (a documented future phase), this same check is what keeps an
 * ordinary signed-up visitor from ever satisfying it — only an allowlisted
 * email does. The returned email is always the real signed-in user's own —
 * with more than one admin listed, that's what makes "which admin edited
 * this" (ContentStamp.lastEditorName) a real answer, not a fixed string.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  if (getAllowedAdminEmails().length === 0) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous || !user.email || !isAllowedAdminEmail(user.email)) return null;
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
