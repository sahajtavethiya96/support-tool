"use client";

import { TrashIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/common/searchable-select";
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
import type { TicketPriority, TicketStatus } from "@/lib/ticket-config";
import { TicketRow } from "./ticket-row";

interface Row {
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  category: string;
  customerName: string;
  id: string;
  priority: string;
  status: string;
  subject: string;
  ticketNumber: number;
  updatedAt: Date;
}

interface Agent {
  email: string;
  id: string;
  name: string | null;
}

interface ColorRow {
  color: string;
  label: string;
}

export function TicketsTable({
  rows,
  statusMap,
  categoryMap,
  priorityMap,
  statuses,
  priorities,
  agents,
  isAdmin,
}: {
  rows: Row[];
  statusMap: Record<string, ColorRow | undefined>;
  categoryMap: Record<string, ColorRow | undefined>;
  priorityMap: Record<string, ColorRow | undefined>;
  statuses: TicketStatus[];
  priorities: TicketPriority[];
  agents: Agent[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function runBulk(body: object) {
    setBusy(true);
    try {
      const res = await fetch("/api/tickets/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), ...body }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "Bulk update failed.");
        return;
      }
      toast.success(
        `Updated ${selected.size} ticket${selected.size === 1 ? "" : "s"}.`
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkDelete() {
    setBusy(true);
    try {
      const res = await fetch("/api/tickets/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "Bulk delete failed.");
        return;
      }
      toast.success(
        `Deleted ${selected.size} ticket${selected.size === 1 ? "" : "s"}.`
      );
      setSelected(new Set());
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Bulk action bar — admin only, shown when rows are selected */}
      {isAdmin && someSelected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {selected.size} selected
          </span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelected(new Set())}
            type="button"
          >
            Clear
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SearchableSelect
              disabled={busy}
              onValueChange={(v) =>
                runBulk({
                  action: "assign",
                  value: v === "unassigned" ? null : v,
                })
              }
              options={[
                { value: "unassigned", label: "Unassign" },
                ...agents.map((a) => ({
                  value: a.id,
                  label: a.name ?? a.email,
                })),
              ]}
              placeholder="Assign to…"
              searchPlaceholder="Search agents…"
              triggerClassName="h-9 w-44"
              value=""
            />
            <SearchableSelect
              disabled={busy}
              onValueChange={(v) => runBulk({ action: "status", value: v })}
              options={statuses.map((s) => ({ value: s.slug, label: s.label }))}
              placeholder="Change status…"
              searchPlaceholder="Search status…"
              triggerClassName="h-9 w-44"
              value=""
            />
            <Button
              className="h-9"
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
              size="sm"
              variant="destructive"
            >
              <TrashIcon className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/50">
                {isAdmin && (
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-16">
                  #
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Subject
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-36 hidden sm:table-cell">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-36 hidden md:table-cell">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-28 hidden md:table-cell">
                  Priority
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-40 hidden lg:table-cell">
                  Customer
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-36 hidden lg:table-cell">
                  Assigned
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-28 hidden xl:table-cell">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <TicketRow
                  agents={agents}
                  categoryMap={categoryMap}
                  isAdmin={isAdmin}
                  key={row.id}
                  onToggleSelect={() => toggleOne(row.id)}
                  priorities={priorities}
                  priorityMap={priorityMap}
                  row={row}
                  selected={selected.has(row.id)}
                  statuses={statuses}
                  statusMap={statusMap}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk delete confirmation */}
      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <WarningCircleIcon
                className="size-6 text-destructive"
                weight="fill"
              />
            </div>
            <DialogTitle className="text-center">
              Delete {selected.size} ticket{selected.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription className="text-center">
              This will permanently delete the selected tickets and their
              attachments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              className="flex-1"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={busy}
              onClick={handleBulkDelete}
              variant="destructive"
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
