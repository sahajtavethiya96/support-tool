"use client";

import {
  CaretUpDownIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  type ColumnPref,
  CUSTOMIZABLE_COLUMNS,
} from "@/lib/tickets-table-columns";
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
  tags: string[];
  ticketNumber: number;
  updatedAt: Date;
  updatedByName: string | null;
}

const COLUMN_META = Object.fromEntries(
  CUSTOMIZABLE_COLUMNS.map((c) => [c.id, c])
);

function SortIcon({
  active,
  order,
}: {
  active: boolean;
  order: "asc" | "desc";
}) {
  if (!active) {
    return <CaretUpDownIcon className="size-3.5 text-muted-foreground/50" />;
  }
  return order === "asc" ? (
    <SortAscendingIcon className="size-3.5 text-foreground" />
  ) : (
    <SortDescendingIcon className="size-3.5 text-foreground" />
  );
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
  columnPrefs,
}: {
  rows: Row[];
  statusMap: Record<string, ColorRow | undefined>;
  categoryMap: Record<string, ColorRow | undefined>;
  priorityMap: Record<string, ColorRow | undefined>;
  statuses: TicketStatus[];
  priorities: TicketPriority[];
  agents: Agent[];
  isAdmin: boolean;
  columnPrefs: ColumnPref[];
}) {
  const visibleColumns = columnPrefs.filter((c) => c.visible);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const activeSort = searchParams.get("sort") === "id" ? "id" : "updatedAt";
  const activeOrder = searchParams.get("order") === "asc" ? "asc" : "desc";

  function toggleSort(column: "id" | "updatedAt") {
    const params = new URLSearchParams(searchParams.toString());
    const nextOrder =
      activeSort === column && activeOrder === "desc" ? "asc" : "desc";
    params.set("sort", column);
    params.set("order", nextOrder);
    params.delete("page"); // reset pagination on sort change
    router.push(`/tickets?${params.toString()}`);
  }

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
          <table className="w-full table-fixed text-xs">
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
                <th className="w-16 px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("id")}
                    type="button"
                  >
                    #
                    <SortIcon
                      active={activeSort === "id"}
                      order={activeOrder}
                    />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-56">
                  Subject
                </th>
                {visibleColumns.map((c) => (
                  <th
                    className={`text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide ${COLUMN_META[c.id].width}`}
                    key={c.id}
                  >
                    {c.id === "updatedAt" ? (
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("updatedAt")}
                        type="button"
                      >
                        {COLUMN_META[c.id].label}
                        <SortIcon
                          active={activeSort === "updatedAt"}
                          order={activeOrder}
                        />
                      </button>
                    ) : (
                      COLUMN_META[c.id].label
                    )}
                  </th>
                ))}
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
                  visibleColumns={visibleColumns}
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
