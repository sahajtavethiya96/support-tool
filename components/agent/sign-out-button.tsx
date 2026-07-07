"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import { logoutAction } from "@/app/actions/auth";

export function SignOutButton() {
  // Uses the server action (signs out server-side + audit-logs + redirects to
  // /login) rather than the client `authClient.signOut()` HTTP call.
  return (
    <form action={logoutAction} className="mt-2">
      <button
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        type="submit"
      >
        <SignOutIcon className="size-3.5" />
        Sign out
      </button>
    </form>
  );
}
