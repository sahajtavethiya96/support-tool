"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userBanned: boolean;
  isCurrentUser: boolean;
  passwordResetEnabled: boolean;
}

export function UserActions({
  userId,
  userName,
  userEmail,
  userRole,
  userBanned,
  isCurrentUser,
  passwordResetEnabled,
}: Props) {
  const router = useRouter();

  // Role dialog
  const [roleOpen, setRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(userRole);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Ban dialog
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleRoleChange() {
    if (selectedRole === userRole) { setRoleOpen(false); return; }
    setRoleLoading(true);
    setRoleError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        const msg = d.error ?? "Failed to update role.";
        setRoleError(msg);
        toast.error(msg);
        return;
      }
      setRoleOpen(false);
      toast.success(`${userName} is now ${selectedRole === ADMIN_ROLE ? "an admin" : "an agent"}.`);
      router.refresh();
    } catch {
      setRoleError("Network error.");
      toast.error("Network error.");
    } finally {
      setRoleLoading(false);
    }
  }

  async function handleBan() {
    setBanLoading(true);
    setBanError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: true, banReason: banReason.trim() || undefined }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        const msg = d.error ?? "Failed to ban user.";
        setBanError(msg);
        toast.error(msg);
        return;
      }
      setBanOpen(false);
      setBanReason("");
      toast.success(`${userName} has been banned.`);
      router.refresh();
    } catch {
      setBanError("Network error.");
      toast.error("Network error.");
    } finally {
      setBanLoading(false);
    }
  }

  async function handleUnban() {
    setBanLoading(true);
    setBanError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: false }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        const msg = d.error ?? "Failed to unban user.";
        setBanError(msg);
        toast.error(msg);
        return;
      }
      setBanOpen(false);
      toast.success(`${userName} has been unbanned.`);
      router.refresh();
    } catch {
      setBanError("Network error.");
      toast.error("Network error.");
    } finally {
      setBanLoading(false);
    }
  }

  async function handleDelete() {
    if (deleteEmail !== userEmail) {
      setDeleteError("Email does not match.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        const msg = d.error ?? "Failed to delete user.";
        setDeleteError(msg);
        toast.error(msg);
        return;
      }
      setDeleteOpen(false);
      toast.success(`${userName} has been deleted.`);
      router.refresh();
    } catch {
      setDeleteError("Network error.");
      toast.error("Network error.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        const msg = d.error ?? "Failed to reset password.";
        setResetError(msg);
        toast.error(msg);
        return;
      }
      setResetOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      toast.success(`Password reset for ${userName}.`);
      router.refresh();
    } catch {
      setResetError("Network error.");
      toast.error("Network error.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs border-border text-foreground hover:bg-accent"
          onClick={() => { setSelectedRole(userRole); setRoleError(null); setRoleOpen(true); }}
        >
          Change Role
        </Button>

        {passwordResetEnabled && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs border-border text-foreground hover:bg-accent"
            onClick={() => {
              setNewPassword("");
              setConfirmPassword("");
              setResetError(null);
              setResetOpen(true);
            }}
          >
            Reset Password
          </Button>
        )}

        {userBanned ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs border-border text-foreground hover:bg-accent"
            onClick={() => { setBanError(null); setBanOpen(true); }}
          >
            Unban
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
            disabled={isCurrentUser}
            onClick={() => { setBanReason(""); setBanError(null); setBanOpen(true); }}
          >
            Ban
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
          onClick={() => { setDeleteEmail(""); setDeleteError(null); setDeleteOpen(true); }}
        >
          Delete
        </Button>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Change Role</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Set the role for <strong className="text-foreground">{userName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 py-1">
            <button
              type="button"
              onClick={() => setSelectedRole(AGENT_ROLE)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                selectedRole === AGENT_ROLE
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-foreground hover:bg-accent"
              }`}
            >
              Agent
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole(ADMIN_ROLE)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                selectedRole === ADMIN_ROLE
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-foreground hover:bg-accent"
              }`}
            >
              Admin
            </button>
          </div>
          {roleError && <p className="text-xs text-red-600">{roleError}</p>}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-border text-foreground"
              onClick={() => setRoleOpen(false)}
              disabled={roleLoading}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleRoleChange}
              disabled={roleLoading}
            >
              {roleLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban / Unban Dialog */}
      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {userBanned ? "Unban User" : "Ban User"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {userBanned
                ? `Restore sign-in access for ${userName}.`
                : `${userName} will be signed out immediately and cannot sign in until unbanned.`}
            </DialogDescription>
          </DialogHeader>
          {!userBanned && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ban reason (optional)</Label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban…"
                className="resize-none"
                rows={2}
              />
            </div>
          )}
          {banError && <p className="text-xs text-red-600">{banError}</p>}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-border text-foreground"
              onClick={() => setBanOpen(false)}
              disabled={banLoading}
            >
              Cancel
            </Button>
            <Button
              className={
                userBanned
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
              onClick={userBanned ? handleUnban : handleBan}
              disabled={banLoading}
            >
              {banLoading
                ? userBanned ? "Unbanning…" : "Banning…"
                : userBanned ? "Unban" : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete User?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Permanently delete <strong className="text-foreground">{userName}</strong>. Their assigned tickets will become unassigned. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Type <span className="font-mono text-foreground">{userEmail}</span> to confirm
            </Label>
            <Input
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              placeholder={userEmail}
            />
          </div>
          {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-border text-foreground"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleteLoading || deleteEmail !== userEmail}
            >
              {deleteLoading ? "Deleting…" : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reset Password</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Set a new password for <strong className="text-foreground">{userName}</strong>. They will not be notified — share the new password with them yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">New password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>
          </div>
          {resetError && <p className="text-xs text-red-600">{resetError}</p>}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-border text-foreground"
              onClick={() => setResetOpen(false)}
              disabled={resetLoading}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleResetPassword}
              disabled={resetLoading || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              {resetLoading ? "Saving…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
