// Human-readable labels for the fixed set of audit action slugs currently
// written by lib/audit.ts call sites. Update this list whenever a new
// `audit({ action: "..." })` call site is added elsewhere in the codebase.
export const AUDIT_ACTIONS: { label: string; value: string }[] = [
  { label: "Logout", value: "auth.logout" },
  { label: "Magic Link Sent", value: "auth.magic_link_sent" },
  { label: "Role Updated", value: "orbit.user_role_updated" },
  { label: "Name Updated", value: "profile.name_updated" },
  { label: "Email Updated", value: "profile.email_updated" },
  { label: "Session Revoked", value: "profile.session_revoked" },
  { label: "Other Sessions Revoked", value: "profile.other_sessions_revoked" },
  { label: "Account Deleted", value: "profile.account_deleted" },
  { label: "Data Exported", value: "profile.data_exported" },
  { label: "User Created", value: "user.created" },
  { label: "Bulk Update", value: "ticket.bulk_update" },
  { label: "Bulk Delete", value: "ticket.bulk_delete" },
  { label: "Canned Response Deleted", value: "canned_response.deleted" },
];

const AUDIT_ACTION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  AUDIT_ACTIONS.map((a) => [a.value, a.label])
);

export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL_MAP[action] ?? action;
}
