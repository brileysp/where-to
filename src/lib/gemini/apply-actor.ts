import type { AdminUser } from '../admin/auth';

// Same well-known "this was a script, not a logged-in human" actor id the existing author-<interest>-blurbs-batchN.ts scripts use for
// their own admin_audit_log inserts. Lives in its own file so apply.ts and todo-sync.ts can both use it without importing each other.
export const SYSTEM_ACTOR: AdminUser = { id: '00000000-0000-0000-0000-000000000000', email: 'gemini-pipeline@system' };
