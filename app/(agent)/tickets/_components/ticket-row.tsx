"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { COLOR_BADGE, formatTicketDate } from "@/lib/tickets";

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

interface Props {
  agents: Agent[];
  categoryMap: Record<string, ColorRow | undefined>;
  isAdmin: boolean;
  onToggleSelect: () => void;
  priorities: TicketPriority[];
  priorityMap: Record<string, ColorRow | undefined>;
  row: Row;
  selected: boolean;
  statuses: TicketStatus[];
  statusMap: Record<string, ColorRow | undefined>;
}

export function TicketRow({
  row,
  statusMap,
  categoryMap,
  priorityMap,
  statuses,
  priorities,
  agents,
  isAdmin,
  selected,
  onToggleSelect,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(row.status);
  const [priority, setPriority] = useState(row.priority);
  const [assignedAgentId, setAssignedAgentId] = useState(row.assignedAgentId);
  const [loading, setLoading] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  useEffect(() => setStatus(row.status), [row.status]);
  useEffect(() => setPriority(row.priority), [row.priority]);
  useEffect(
    () => setAssignedAgentId(row.assignedAgentId),
    [row.assignedAgentId]
  );

  async function patch(body: object) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(data?.error ?? "Update failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      toast.error("Network error.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    // Moving to a closed state needs confirmation (it notifies the customer).
    if (statuses.find((s) => s.slug === newStatus)?.isClosedState) {
      setPendingStatus(newStatus);
      setCloseOpen(true);
      return;
    }
    const ok = await patch({ status: newStatus });
    if (ok) {
      setStatus(newStatus);
      toast.success(
        `Status changed to ${statusMap[newStatus]?.label ?? newStatus}.`
      );
    }
  }

  async function handleConfirmClose() {
    if (!pendingStatus) {
      setCloseOpen(false);
      return;
    }
    const ok = await patch({ status: pendingStatus });
    if (ok) {
      setStatus(pendingStatus);
      toast.success("Ticket closed. The customer has been notified.");
    }
    setCloseOpen(false);
    setPendingStatus(null);
  }

  async function handlePriorityChange(newPriority: string) {
    const ok = await patch({ priority: newPriority });
    if (ok) {
      setPriority(newPriority);
      toast.success(
        `Priority changed to ${priorityMap[newPriority]?.label ?? newPriority}.`
      );
    }
  }

  async function handleAssignChange(agentId: string) {
    const newId = agentId === "unassigned" ? null : agentId;
    const ok = await patch({ assignedAgentId: newId });
    if (ok) {
      setAssignedAgentId(newId);
      toast.success(newId ? "Ticket assigned." : "Ticket unassigned.");
    }
  }

  return (
    <>
      <tr
        className={`hover:bg-accent/40 transition-colors group ${
          selected ? "bg-primary/5" : ""
        }`}
      >
        {isAdmin && (
          <td className="px-4 py-3">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
          </td>
        )}
        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
          #{row.ticketNumber}
        </td>
        <td className="px-4 py-3">
          <Link
            className="font-medium text-foreground hover:underline line-clamp-1"
            href={`/tickets/${row.id}`}
          >
            {row.subject}
          </Link>
          {/* Mobile: show status inline (read-only — edit from the ticket page) */}
          <div className="flex gap-1.5 mt-1 sm:hidden">
            <span
              className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${COLOR_BADGE[statusMap[row.status]?.color ?? "slate"] ?? ""}`}
            >
              {statusMap[row.status]?.label ?? row.status}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <SearchableSelect
            disabled={loading}
            onValueChange={handleStatusChange}
            options={statuses.map((s) => ({ value: s.slug, label: s.label }))}
            searchPlaceholder="Search status…"
            triggerClassName={`h-7 w-full text-xs border ${COLOR_BADGE[statusMap[status]?.color ?? "slate"] ?? "border-border"}`}
            value={status}
          />
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <span
            className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${COLOR_BADGE[categoryMap[row.category]?.color ?? "slate"] ?? ""}`}
          >
            {categoryMap[row.category]?.label ?? row.category}
          </span>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <SearchableSelect
            disabled={loading}
            onValueChange={handlePriorityChange}
            options={priorities.map((p) => ({
              value: p.slug,
              label: p.label,
            }))}
            searchPlaceholder="Search priority…"
            triggerClassName={`h-7 w-full text-xs border ${COLOR_BADGE[priorityMap[priority]?.color ?? "slate"] ?? "border-border"}`}
            value={priority}
          />
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <span
            className="block max-w-36 truncate text-muted-foreground text-xs"
            title={row.customerName}
          >
            {row.customerName}
          </span>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <SearchableSelect
            disabled={loading}
            onValueChange={handleAssignChange}
            options={[
              { value: "unassigned", label: "Unassigned" },
              ...agents.map((a) => ({ value: a.id, label: a.name ?? a.email })),
            ]}
            searchPlaceholder="Search agents…"
            triggerClassName="h-7 w-full text-xs"
            value={assignedAgentId ?? "unassigned"}
          />
        </td>
        <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell whitespace-nowrap">
          {formatTicketDate(row.updatedAt)}
        </td>
      </tr>

      {/* Close confirmation — moving to a closed status notifies the customer */}
      <Dialog onOpenChange={setCloseOpen} open={closeOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Close this ticket?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              The ticket will be marked as closed and the customer will be
              notified by email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              className="border-border text-foreground hover:bg-accent"
              onClick={() => {
                setCloseOpen(false);
                setPendingStatus(null);
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={loading} onClick={handleConfirmClose}>
              {loading ? "Closing…" : "Close Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
