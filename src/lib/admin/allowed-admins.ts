/**
 * The set of emails allowed to act as admin — see auth.ts's getAdminUser
 * and admin/login/actions.ts, the two places that need this exact list.
 * Extracted here so both check membership the same way, once, rather than
 * two independent implementations quietly drifting apart.
 *
 * `ADMIN_EMAILS` (comma-separated) is the current, multi-admin-capable
 * form — added so `AdminUser.email`, which was always the real
 * authenticated user's own email (never a hardcoded string), can finally
 * mean something distinct per person once more than one is listed. Content
 * provenance (schema.ts's ContentStamp.lastEditorName) reads straight from
 * that email, so this is what makes "which user edited this" a real,
 * distinguishable answer instead of every edit looking identical.
 *
 * `ADMIN_EMAIL` (singular) still works unchanged for a one-admin setup —
 * nobody's existing .env.local breaks by not knowing this exists yet.
 */
export function getAllowedAdminEmails(): string[] {
  const list = process.env.ADMIN_EMAILS;
  if (list && list.trim()) {
    return list
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  const single = process.env.ADMIN_EMAIL;
  return single && single.trim() ? [single.trim().toLowerCase()] : [];
}

export function isAllowedAdminEmail(email: string): boolean {
  return getAllowedAdminEmails().includes(email.trim().toLowerCase());
}
