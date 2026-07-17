"use client";

import { ClockIcon, TrashIcon, UserIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/common/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/lib/ticket-config";
import { COLOR_BADGE, formatTicketDateTime } from "@/lib/tickets";
import { getInitials } from "@/lib/utils";
import { SidebarCard } from "./sidebar-card";
import { TicketTags } from "./ticket-tags";

type Agent = { id: string; name: string | null; email: string };

interface Activity {
  action: string;
  actorName: string;
  actorRole: string;
  createdAt: Date;
  id: string;
  metadata: unknown;
}

interface Props {
  activity: Activity[];
  agents: Agent[];
  categories: TicketCategory[];
  currentUserId: string;
  isAdmin?: boolean;
  priorities: TicketPriority[];
  statuses: TicketStatus[];
  tags: Array<{ id: string; name: string }>;
  ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    status: string;
    category: string;
    priority: string;
    customerName: string;
    customerEmail: string;
    assignedAgentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
  };
}

export function TicketInfoSidebar({
  ticket,
  agents,
  activity,
  statuses,
  categories,
  priorities,
  tags,
  currentUserId,
  isAdmin = false,
}: Props) {
  const statusMap = Object.fromEntries(statuses.map((s) => [s.slug, s]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const priorityMap = Object.fromEntries(priorities.map((p) => [p.slug, p]));
  const closedStatus = statuses.find((s) => s.isClosedState);
  const defaultStatus = statuses.find((s) => s.isDefault);

  const ACTION_LABELS: Record<string, (a: Activity) => string> = {
    ticket_created: () => "Ticket submitted",
    ticket_closed: () => "Ticket closed",
    ticket_reopened: () => "Ticket reopened",
    status_changed: (a) => {
      const m = a.metadata as { from?: string; to?: string } | null;
      return `Status: ${statusMap[m?.from ?? ""]?.label ?? m?.from} → ${statusMap[m?.to ?? ""]?.label ?? m?.to}`;
    },
    priority_changed: (a) => {
      const m = a.metadata as { from?: string; to?: string } | null;
      return `Priority: ${priorityMap[m?.from ?? ""]?.label ?? m?.from} → ${priorityMap[m?.to ?? ""]?.label ?? m?.to}`;
    },
    assigned: (a) => {
      const m = a.metadata as { agentName?: string } | null;
      return `Assigned to ${m?.agentName ?? "agent"}`;
    },
    unassigned: () => "Unassigned",
    comment_added: (a) =>
      `${a.actorRole === "customer" ? "Customer" : "Agent"} replied`,
    internal_note_added: () => "Internal note added",
    attachment_added: () => "Attachment added",
    attachment_deleted: (a) => {
      const m = a.metadata as { filename?: string } | null;
      return `Attachment deleted${m?.filename ? `: ${m.filename}` : ""}`;
    },
    tag_added: (a) => {
      const m = a.metadata as { tag?: string } | null;
      return `Tag added${m?.tag ? `: ${m.tag}` : ""}`;
    },
    tag_removed: (a) => {
      const m = a.metadata as { tag?: string } | null;
      return `Tag removed${m?.tag ? `: ${m.tag}` : ""}`;
    },
  };
  const router = useRouter();

  // Accordion: only one sidebar section open at a time. `null` = all closed.
  const [openSection, setOpenSection] = useState<string | null>("ticket-info");
  const accordionProps = (key: string) => ({
    open: openSection === key,
    onOpenChange: (o: boolean) => setOpenSection(o ? key : null),
  });

  const [status, setStatus] = useState(ticket.status);
  const [category, setCategory] = useState(ticket.category);
  const [priority, setPriority] = useState(ticket.priority);
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(
    ticket.assignedAgentId
  );
  const [closeOpen, setCloseOpen] = useState(false);
  const [pendingClose, setPendingClose] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: object) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg = data.error ?? "Update failed.";
        setError(msg);
        toast.error(msg);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      toast.error("Network error.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    // Moving to a closed state needs confirmation (it notifies the customer).
    if (statusMap[newStatus]?.isClosedState) {
      setPendingClose(newStatus);
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
    const target = pendingClose ?? closedStatus?.slug;
    if (!target) {
      setCloseOpen(false);
      return;
    }
    const ok = await patch({ status: target });
    if (ok) {
      setStatus(target);
      setCloseOpen(false);
      setPendingClose(null);
      toast.success("Ticket closed. The customer has been notified.");
    }
  }

  async function handleCategoryChange(newCategory: string) {
    const ok = await patch({ category: newCategory });
    if (ok) {
      setCategory(newCategory);
      toast.success(
        `Category changed to ${categoryMap[newCategory]?.label ?? newCategory}.`
      );
    }
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

  async function handleReopen() {
    const res = await fetch(`/api/tickets/${ticket.id}/reopen`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        status?: string;
      } | null;
      setStatus(data?.status ?? defaultStatus?.slug ?? status);
      toast.success("Ticket reopened.");
      router.refresh();
    } else {
      toast.error("Failed to reopen ticket.");
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Ticket deleted.");
        router.push("/tickets");
      } else {
        toast.error("Failed to delete ticket.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <aside className="space-y-5">
      {/* Ticket Info */}
      <SidebarCard
        contentClassName="space-y-4"
        title="Ticket Info"
        {...accordionProps("ticket-info")}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Number</span>
            <span className="text-xs font-mono font-medium text-foreground">
              #{ticket.ticketNumber}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <SearchableSelect
              disabled={loading}
              onValueChange={handleStatusChange}
              options={statuses.map((s) => ({ value: s.slug, label: s.label }))}
              searchPlaceholder="Search status…"
              triggerClassName={`h-8 w-full text-xs border ${COLOR_BADGE[statusMap[status]?.color ?? "slate"] ?? "border-border"}`}
              value={status}
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Priority</span>
            <SearchableSelect
              disabled={loading}
              onValueChange={handlePriorityChange}
              options={priorities.map((p) => ({
                value: p.slug,
                label: p.label,
              }))}
              searchPlaceholder="Search priority…"
              triggerClassName={`h-8 w-full text-xs border ${COLOR_BADGE[priorityMap[priority]?.color ?? "slate"] ?? "border-border"}`}
              value={priority}
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Category</span>
            <SearchableSelect
              disabled={loading}
              onValueChange={handleCategoryChange}
              options={categories.map((c) => ({
                value: c.slug,
                label: categoryMap[c.slug]?.label ?? c.label,
              }))}
              searchPlaceholder="Search category…"
              triggerClassName="h-8 w-full text-xs"
              value={category}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Created</span>
            <span className="text-xs text-foreground">
              {formatTicketDateTime(ticket.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Updated</span>
            <span className="text-xs text-foreground">
              {formatTicketDateTime(ticket.updatedAt)}
            </span>
          </div>
          {ticket.closedAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Closed</span>
              <span className="text-xs text-foreground">
                {formatTicketDateTime(ticket.closedAt)}
              </span>
            </div>
          )}
        </div>

        {statusMap[status]?.isClosedState ? (
          <Button
            className="w-full border-border text-foreground hover:bg-accent text-xs"
            disabled={loading}
            onClick={handleReopen}
            size="sm"
            variant="outline"
          >
            Reopen Ticket
          </Button>
        ) : (
          <Button
            className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs"
            disabled={loading}
            onClick={() => {
              setPendingClose(null);
              setCloseOpen(true);
            }}
            size="sm"
            variant="outline"
          >
            Close Ticket
          </Button>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </SidebarCard>

      {/* Tags */}
      <SidebarCard title="Tags" {...accordionProps("tags")}>
        <TicketTags initialTags={tags} ticketId={ticket.id} />
      </SidebarCard>

      {/* Customer Info */}
      <SidebarCard title="Customer" {...accordionProps("customer")}>
        <div className="flex items-start gap-2.5">
          <div className="size-7 rounded-full bg-accent border border-border flex items-center justify-center text-xs font-medium text-foreground shrink-0">
            {getInitials(ticket.customerName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {ticket.customerName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {ticket.customerEmail}
            </p>
          </div>
        </div>
      </SidebarCard>

      {/* Assigned Agent */}
      <SidebarCard
        contentClassName="space-y-3"
        title="Assigned Agent"
        {...accordionProps("assigned-agent")}
      >
        <SearchableSelect
          disabled={loading}
          onValueChange={handleAssignChange}
          options={[
            { value: "unassigned", label: "Unassigned" },
            ...agents.map((a) => ({ value: a.id, label: a.name ?? a.email })),
          ]}
          searchPlaceholder="Search agents…"
          triggerClassName="h-8 w-full text-xs"
          value={assignedAgentId ?? "unassigned"}
        />
        {assignedAgentId !== currentUserId && (
          <Button
            className="w-full border-border text-foreground hover:bg-accent text-xs flex items-center gap-1.5"
            disabled={loading}
            onClick={() => handleAssignChange(currentUserId)}
            size="sm"
            variant="outline"
          >
            <UserIcon className="size-3" />
            Assign to me
          </Button>
        )}
      </SidebarCard>

      {/* Activity */}
      <SidebarCard
        icon={<ClockIcon className="size-3.5" />}
        title="Activity"
        {...accordionProps("activity")}
      >
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {activity.map((a) => {
            const label = ACTION_LABELS[a.action]?.(a) ?? a.action;
            return (
              <div className="flex gap-2 text-xs" key={a.id}>
                <span className="size-1.5 rounded-full bg-muted mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">{label}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {a.actorName} · {formatTicketDateTime(a.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </SidebarCard>

      {/* Admin: Delete Ticket */}
      {isAdmin && (
        <SidebarCard
          className="border-red-200"
          title="Danger Zone"
          titleClassName="text-red-600"
          {...accordionProps("danger-zone")}
        >
          <Button
            className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs flex items-center gap-1.5"
            onClick={() => setDeleteOpen(true)}
            size="sm"
            variant="outline"
          >
            <TrashIcon className="size-3.5" />
            Delete Ticket
          </Button>
        </SidebarCard>
      )}

      {/* Close confirmation dialog */}
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
              className="border-border text-foreground"
              disabled={loading}
              onClick={() => setCloseOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={loading}
              onClick={handleConfirmClose}
            >
              {loading ? "Closing…" : "Close Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Ticket dialog */}
      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-red-100">
              <TrashIcon className="size-5 text-red-600" />
            </div>
            <DialogTitle className="text-foreground text-center">
              Delete ticket #{ticket.ticketNumber}?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              All comments and attachments will be permanently deleted. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              className="flex-1 border-border text-foreground"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
