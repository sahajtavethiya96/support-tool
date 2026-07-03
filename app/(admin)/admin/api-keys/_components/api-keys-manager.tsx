"use client";

import {
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  KeyIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { formatDateTime } from "@/lib/utils";

interface ApiKeyRow {
  createdAt: Date;
  createdByName: string;
  id: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  name: string;
  revokedAt: Date | null;
}

interface Props {
  initialKeys: ApiKeyRow[];
}

export function ApiKeysManager({ initialKeys }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  function openAdd() {
    setName("");
    setError(null);
    setCreatedKey(null);
    setCopied(false);
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
    setCreatedKey(null);
    if (createdKey) {
      router.refresh();
    }
  }

  async function handleCreate() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { error?: string; rawKey?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create key.");
        return;
      }
      setCreatedKey(data.rawKey ?? null);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!createdKey) {
      return;
    }
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
  }

  async function handleRevoke() {
    if (!revokeTarget) {
      return;
    }
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/api-keys/${revokeTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setRevoking(false);
        return;
      }
      setRevokeTarget(null);
      router.refresh();
    } finally {
      setRevoking(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">API Keys</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Let external websites create tickets programmatically.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            asChild
            className="border-border text-foreground hover:bg-accent rounded-md gap-1.5"
            size="sm"
            variant="outline"
          >
            <a
              download
              href="/api/admin/api-keys/postman"
              title="Downloads a Postman collection pre-filled with this instance's URL"
            >
              <DownloadSimpleIcon className="size-4" />
              Postman Collection
            </a>
          </Button>
          <Button
            asChild
            className="border-border text-foreground hover:bg-accent rounded-md gap-1.5"
            size="sm"
            variant="outline"
          >
            <Link href="/admin/api-keys/docs">
              <BookOpenIcon className="size-4" />
              View Docs
            </Link>
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md gap-1.5"
            onClick={openAdd}
            size="sm"
          >
            <PlusIcon className="size-4" />
            Create API Key
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {initialKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <KeyIcon className="size-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">
              No API keys yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Create one to let an external site submit tickets via the API.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Key
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Created by
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                    Last used
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {initialKeys.map((k) => (
                  <tr
                    className="hover:bg-accent/30 transition-colors"
                    key={k.id}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {k.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {k.keyPrefix}…
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {k.createdByName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
                          k.revokedAt
                            ? "bg-red-50 border-red-200 text-red-600"
                            : "bg-green-50 border-green-200 text-green-700"
                        }`}
                      >
                        {k.revokedAt ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!k.revokedAt && (
                        <Button
                          className="h-8 border-red-200 text-red-600 hover:bg-red-50 rounded-md"
                          onClick={() => setRevokeTarget(k)}
                          size="sm"
                          variant="outline"
                        >
                          <TrashIcon className="size-3.5" />
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog onOpenChange={(open) => !open && closeAdd()} open={addOpen}>
        <DialogContent className="rounded-xl max-w-sm">
          {createdKey ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  API key created
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Copy this key now — it won't be shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-md border border-border bg-accent px-3 py-2">
                <code className="text-xs text-foreground break-all flex-1">
                  {createdKey}
                </code>
                <button
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? (
                    <CheckIcon className="size-4 text-green-600" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </button>
              </div>
              <DialogFooter>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
                  onClick={closeAdd}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  Create API Key
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Name it after where it'll be used, e.g. "Marketing site".
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Name
                </Label>
                <Input
                  className="rounded-md"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marketing site"
                  value={name}
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <DialogFooter className="gap-2">
                <Button
                  className="flex-1 border-border text-foreground rounded-md"
                  disabled={saving}
                  onClick={() => setAddOpen(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
                  disabled={saving || !name.trim()}
                  onClick={handleCreate}
                >
                  {saving ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        open={revokeTarget !== null}
      >
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-red-100">
              <WarningCircleIcon className="size-5 text-red-600" />
            </div>
            <DialogTitle className="text-foreground text-center">
              Revoke &ldquo;{revokeTarget?.name}&rdquo;?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              Any integration using this key will immediately start getting 401
              errors. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              className="flex-1 border-border text-foreground rounded-md"
              disabled={revoking}
              onClick={() => setRevokeTarget(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-md"
              disabled={revoking}
              onClick={handleRevoke}
            >
              {revoking ? "Revoking…" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
