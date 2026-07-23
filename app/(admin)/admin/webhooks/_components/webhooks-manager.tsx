"use client";

import {
  ArrowsClockwiseIcon,
  BookOpenIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
  WebhooksLogoIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";
import { formatDateTime } from "@/lib/utils";

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdByName: string;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
}

interface DeliveryRow {
  id: string;
  event: string;
  status: "queued" | "sending" | "sent" | "failed";
  attemptCount: number;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: string;
}

interface Props {
  initialWebhooks: WebhookRow[];
}

const emptyForm = { name: "", url: "", events: [] as string[] };

export function WebhooksManager({ initialWebhooks }: Props) {
  const router = useRouter();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState<{
    title: string;
    secret: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [editTarget, setEditTarget] = useState<WebhookRow | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<WebhookRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [deliveriesTarget, setDeliveriesTarget] = useState<WebhookRow | null>(
    null
  );
  const [deliveries, setDeliveries] = useState<DeliveryRow[] | null>(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  function openAdd() {
    setForm({
      ...emptyForm,
      events: WEBHOOK_EVENTS.filter((e) => e.defaultEnabled).map(
        (e) => e.value
      ),
    });
    setError(null);
    setAddOpen(true);
  }

  function toggleEvent(
    events: string[],
    setEvents: (v: string[]) => void,
    value: string
  ) {
    setEvents(
      events.includes(value)
        ? events.filter((e) => e !== value)
        : [...events, value]
    );
  }

  async function handleCreate() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as {
        error?: string;
        rawSecret?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to create webhook.");
        return;
      }
      setAddOpen(false);
      setRevealSecret({
        title: "Webhook created",
        secret: data.rawSecret ?? "",
      });
      setCopied(false);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function closeReveal() {
    setRevealSecret(null);
    router.refresh();
  }

  async function handleCopy() {
    if (!revealSecret) {
      return;
    }
    await navigator.clipboard.writeText(revealSecret.secret);
    setCopied(true);
  }

  function openEdit(w: WebhookRow) {
    setEditTarget(w);
    setEditForm({ name: w.name, url: w.url, events: w.events });
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editTarget) {
      return;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/webhooks/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditError(data.error ?? "Failed to save.");
        return;
      }
      setEditTarget(null);
      router.refresh();
    } catch {
      setEditError("Network error.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(w: WebhookRow) {
    const res = await fetch(`/api/admin/webhooks/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !w.isActive }),
    });
    if (res.ok) {
      toast.success(w.isActive ? "Webhook disabled." : "Webhook enabled.");
      router.refresh();
    } else {
      toast.error("Failed to update webhook.");
    }
  }

  async function handleRotateSecret(w: WebhookRow) {
    const res = await fetch(`/api/admin/webhooks/${w.id}/rotate-secret`, {
      method: "POST",
    });
    const data = (await res.json()) as { error?: string; rawSecret?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Failed to rotate secret.");
      return;
    }
    setRevealSecret({
      title: `New secret for "${w.name}"`,
      secret: data.rawSecret ?? "",
    });
    setCopied(false);
  }

  async function handleTest(w: WebhookRow) {
    const res = await fetch(`/api/admin/webhooks/${w.id}/test`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Test event queued — check the delivery history shortly.");
    } else {
      toast.error("Failed to send test event.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/webhooks/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete webhook.");
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function openDeliveries(w: WebhookRow) {
    setDeliveriesTarget(w);
    setDeliveries(null);
    setDeliveriesLoading(true);
    try {
      const res = await fetch(`/api/admin/webhooks/${w.id}/deliveries`);
      if (res.ok) {
        setDeliveries((await res.json()) as DeliveryRow[]);
      }
    } finally {
      setDeliveriesLoading(false);
    }
  }

  async function handleRedeliver(deliveryId: string) {
    const res = await fetch(
      `/api/admin/webhooks/deliveries/${deliveryId}/redeliver`,
      { method: "POST" }
    );
    if (res.ok && deliveriesTarget) {
      toast.success("Redelivery queued.");
      openDeliveries(deliveriesTarget);
    } else {
      toast.error("Failed to redeliver.");
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Webhooks
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Send a signed HTTP POST to your own server when ticket events
            happen.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            asChild
            className="border-border text-foreground hover:bg-accent rounded-md gap-1.5"
            size="sm"
            variant="outline"
          >
            <Link href="/admin/webhooks/docs">
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
            Add Webhook
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {initialWebhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <WebhooksLogoIcon className="size-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">
              No webhooks yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add one to notify your own server of ticket events.
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
                    URL
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                    Events
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Last delivery
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Active
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {initialWebhooks.map((w) => (
                  <tr
                    className="hover:bg-accent/30 transition-colors"
                    key={w.id}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {w.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-56 truncate" title={w.url}>
                      {w.url}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-64 truncate" title={w.events.join(", ")}>
                      {w.events.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-xs hidden md:table-cell">
                      {w.lastDeliveryAt ? (
                        <span
                          className={
                            w.lastDeliveryStatus === "sent"
                              ? "text-green-700"
                              : "text-red-600"
                          }
                        >
                          {w.lastDeliveryStatus === "sent"
                            ? "Delivered"
                            : "Failed"}{" "}
                          {formatDateTime(w.lastDeliveryAt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={w.isActive}
                        onCheckedChange={() => handleToggleActive(w)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <Button
                          className="h-8 border-border text-foreground hover:bg-accent rounded-md"
                          onClick={() => handleTest(w)}
                          size="sm"
                          title="Send test event"
                          variant="outline"
                        >
                          <PaperPlaneTiltIcon className="size-3.5" />
                        </Button>
                        <Button
                          className="h-8 border-border text-foreground hover:bg-accent rounded-md"
                          onClick={() => openDeliveries(w)}
                          size="sm"
                          title="Delivery history"
                          variant="outline"
                        >
                          <ClockCounterClockwiseIcon className="size-3.5" />
                        </Button>
                        <Button
                          className="h-8 border-border text-foreground hover:bg-accent rounded-md"
                          onClick={() => handleRotateSecret(w)}
                          size="sm"
                          title="Rotate secret"
                          variant="outline"
                        >
                          <ArrowsClockwiseIcon className="size-3.5" />
                        </Button>
                        <Button
                          className="h-8 border-border text-foreground hover:bg-accent rounded-md"
                          onClick={() => openEdit(w)}
                          size="sm"
                          title="Edit"
                          variant="outline"
                        >
                          <PencilSimpleIcon className="size-3.5" />
                        </Button>
                        <Button
                          className="h-8 border-red-200 text-red-600 hover:bg-red-50 rounded-md"
                          onClick={() => setDeleteTarget(w)}
                          size="sm"
                          title="Delete"
                          variant="outline"
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Webhook</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              We'll POST a signed JSON payload to this URL for every event you
              select.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              className="rounded-md"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Zapier"
              value={form.name}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              URL
            </Label>
            <Input
              className="rounded-md font-mono text-xs"
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/webhooks/support-tool"
              value={form.url}
            />
          </div>
          <EventCheckboxes
            events={form.events}
            onToggle={(value) =>
              toggleEvent(form.events, (v) => setForm({ ...form, events: v }), value)
            }
          />
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
              disabled={saving || !form.name.trim() || !form.url.trim() || form.events.length === 0}
              onClick={handleCreate}
            >
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal secret (creation or rotation) */}
      <Dialog onOpenChange={(open) => !open && closeReveal()} open={revealSecret !== null}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {revealSecret?.title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Copy this signing secret now — it won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border bg-accent px-3 py-2">
            <code className="text-xs text-foreground break-all flex-1">
              {revealSecret?.secret}
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
              onClick={closeReveal}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog onOpenChange={(open) => !open && setEditTarget(null)} open={editTarget !== null}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Webhook</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              The signing secret never changes here — use "Rotate secret" for that.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              className="rounded-md"
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              value={editForm.name}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              URL
            </Label>
            <Input
              className="rounded-md font-mono text-xs"
              onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
              value={editForm.url}
            />
          </div>
          <EventCheckboxes
            events={editForm.events}
            onToggle={(value) =>
              toggleEvent(editForm.events, (v) => setEditForm({ ...editForm, events: v }), value)
            }
          />
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <DialogFooter className="gap-2">
            <Button
              className="flex-1 border-border text-foreground rounded-md"
              disabled={editSaving}
              onClick={() => setEditTarget(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
              disabled={editSaving || !editForm.name.trim() || !editForm.url.trim() || editForm.events.length === 0}
              onClick={handleEditSave}
            >
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog onOpenChange={(open) => !open && setDeleteTarget(null)} open={deleteTarget !== null}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-red-100">
              <WarningCircleIcon className="size-5 text-red-600" />
            </div>
            <DialogTitle className="text-foreground text-center">
              Delete &ldquo;{deleteTarget?.name}&rdquo;?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              This deletes the endpoint and its delivery history. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              className="flex-1 border-border text-foreground rounded-md"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-md"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery history */}
      <Dialog
        onOpenChange={(open) => !open && setDeliveriesTarget(null)}
        open={deliveriesTarget !== null}
      >
        <DialogContent className="rounded-xl max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Deliveries — {deliveriesTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Most recent 50 attempts.
            </DialogDescription>
          </DialogHeader>
          {deliveriesLoading && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {!deliveriesLoading && deliveries?.length === 0 && (
            <p className="text-xs text-muted-foreground">No deliveries yet.</p>
          )}
          {deliveries && deliveries.length > 0 && (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div
                  className="rounded-md border border-border p-3 text-xs"
                  key={d.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {d.event}
                    </span>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-medium ${
                        d.status === "sent"
                          ? "bg-green-50 border-green-200 text-green-700"
                          : d.status === "failed"
                            ? "bg-red-50 border-red-200 text-red-600"
                            : "bg-accent border-border text-muted-foreground"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {formatDateTime(d.createdAt)} · attempt {d.attemptCount}
                    {d.responseStatus ? ` · HTTP ${d.responseStatus}` : ""}
                  </p>
                  {d.lastError && (
                    <p className="text-red-600 mt-1 break-all">
                      {d.lastError}
                    </p>
                  )}
                  {d.status === "failed" && (
                    <Button
                      className="mt-2 h-7 border-border text-foreground hover:bg-accent rounded-md"
                      onClick={() => handleRedeliver(d.id)}
                      size="sm"
                      variant="outline"
                    >
                      Redeliver
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EventCheckboxes({
  events,
  onToggle,
}: {
  events: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        Events
      </Label>
      <div className="space-y-2 rounded-md border border-border p-3 max-h-48 overflow-y-auto">
        {WEBHOOK_EVENTS.map((e) => (
          <label
            className="flex items-start gap-2 cursor-pointer"
            key={e.value}
          >
            <Checkbox
              checked={events.includes(e.value)}
              className="mt-0.5"
              onCheckedChange={() => onToggle(e.value)}
            />
            <span>
              <span className="block text-sm text-foreground">
                {e.label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {e.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
