"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { logoutAction } from "@/app/actions/auth";

export function SignOutButton() {
  // Uses the server action (signs out server-side + audit-logs + redirects to
  // /login) rather than the client `authClient.signOut()` HTTP call.
  return (
    <form action={logoutAction} className="mt-1">
      <button
        type="submit"
        className="flex items-center gap-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors w-full"
      >
        <SignOutIcon className="size-3.5" />
        Sign out
      </button>
    </form>
  );
}
