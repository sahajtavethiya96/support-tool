import { ArrowLeftIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketDetailRealtime } from "@/components/agent/ticket-detail-realtime";
import { DeletableTicketAttachments } from "@/components/common/deletable-ticket-attachments";
import { RichTextContent } from "@/components/common/rich-text-content";
import { ScrollToBottomOnMount } from "@/components/common/scroll-to-bottom-on-mount";
import { ADMIN_ROLE } from "@/config/platform";
import { user } from "@/db/schema/auth";
import {
  ticketActivity,
  ticketAttachments,
  ticketComments,
  tickets,
} from "@/db/schema/tickets";
import { requireAgent } from "@/lib/authz";
import { getCannedResponses } from "@/lib/canned-responses";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import {
  getTicketCategories,
  getTicketPriorities,
  getTicketStatuses,
} from "@/lib/ticket-config";
import { COLOR_BADGE, formatTicketDateTime } from "@/lib/tickets";
import { getInitials } from "@/lib/utils";
import { AgentReplyForm } from "./_components/agent-reply-form";
import { TicketInfoSidebar } from "./_components/ticket-info-sidebar";

interface Props {
  params: Promise<{ ticketId: string }>;
}

export default async function AgentTicketDetailPage({ params }: Props) {
  const { ticketId } = await params;
  const session = await requireAgent();

  const [ticket] = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      description: tickets.description,
      category: tickets.category,
      status: tickets.status,
      priority: tickets.priority,
      customerName: tickets.customerName,
      customerEmail: tickets.customerEmail,
      assignedAgentId: tickets.assignedAgentId,
      closedAt: tickets.closedAt,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) {
    notFound();
  }

  const [statuses, categories, priorities, cannedResponses] = await Promise.all(
    [
      getTicketStatuses(),
      getTicketCategories(),
      getTicketPriorities(),
      getCannedResponses(),
    ]
  );

  const statusMap = Object.fromEntries(statuses.map((s) => [s.slug, s]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  // All comments — agents see internal notes too
  const comments = await db
    .select()
    .from(ticketComments)
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(asc(ticketComments.createdAt));

  const attachments = await db
    .select()
    .from(ticketAttachments)
    .where(eq(ticketAttachments.ticketId, ticketId));

  const ticketLevelAttachments = attachments.filter((a) => !a.commentId);
  const attachmentsByComment = new Map<string, typeof attachments>();
  for (const a of attachments) {
    if (a.commentId) {
      if (!attachmentsByComment.has(a.commentId)) {
        attachmentsByComment.set(a.commentId, []);
      }
      attachmentsByComment.get(a.commentId)!.push(a);
    }
  }

  const activity = await db
    .select()
    .from(ticketActivity)
    .where(eq(ticketActivity.ticketId, ticketId))
    .orderBy(asc(ticketActivity.createdAt));

  // Agents for assignment dropdown
  const agents = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.banned, false)));

  const isOpen = !(statusMap[ticket.status]?.isClosedState ?? false);

  return (
    <div className="p-4 lg:p-6">
      <TicketDetailRealtime ticketId={ticket.id} />
      {/* Breadcrumb — stays pinned to the top of the scroll area, carrying the
          ticket's subject + status along so context stays visible while
          scrolled away from the ticket header card below. */}
      <div className="sticky top-0 z-10 -mx-4 lg:-mx-6 mb-5 flex h-12 items-center gap-2 bg-surface px-4 lg:px-6">
        <Link
          className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          href="/tickets"
        >
          <ArrowLeftIcon className="size-3.5" />
          All Tickets
        </Link>
        <span className="shrink-0 text-muted-foreground text-sm">/</span>
        <span className="shrink-0 text-sm text-foreground font-medium">
          #{ticket.ticketNumber}
        </span>
        <span className="shrink-0 text-muted-foreground text-sm">·</span>
        <span className="min-w-0 truncate text-sm text-foreground">
          {ticket.subject}
        </span>
        <span
          className={`ml-auto inline-flex shrink-0 items-center rounded border px-2.5 py-1 text-xs font-medium ${COLOR_BADGE[statusMap[ticket.status]?.color ?? "slate"] ?? ""}`}
        >
          {statusMap[ticket.status]?.label ?? ticket.status}
        </span>
      </div>

      <div className="flex gap-6 items-start flex-col lg:flex-row">
        {/* ── Main panel ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Ticket header */}
          <div className="bg-card rounded-xl border border-border shadow-soft p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-muted-foreground font-mono">
                    #{ticket.ticketNumber}
                  </span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground">
                    {categoryMap[ticket.category]?.label ?? ticket.category}
                  </span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTicketDateTime(ticket.createdAt)}
                  </span>
                </div>
                <h1 className="text-lg font-semibold text-foreground wrap-break-word">
                  {ticket.subject}
                </h1>
              </div>
              <span
                className={`inline-flex items-center rounded border px-2.5 py-1 text-xs font-medium shrink-0 ${COLOR_BADGE[statusMap[ticket.status]?.color ?? "slate"] ?? ""}`}
              >
                {statusMap[ticket.status]?.label ?? ticket.status}
              </span>
            </div>
          </div>

          {/* Original description — customer's first message (left) */}
          <div className="flex justify-start gap-2">
            <div className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">
              {getInitials(ticket.customerName)}
            </div>
            <div className="max-w-[85%] bg-accent rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-foreground">
                  {ticket.customerName}
                </span>
                <span className="text-xs text-muted-foreground">Customer</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {formatTicketDateTime(ticket.createdAt)}
                </span>
              </div>
              <RichTextContent content={ticket.description} />
              {ticketLevelAttachments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <DeletableTicketAttachments
                    items={ticketLevelAttachments.map((a) => ({
                      id: a.id,
                      url: storage.url(a.storageKey),
                      filename: a.filename,
                      mimeType: a.mimeType,
                      fileSize: a.fileSize,
                    }))}
                    ticketId={ticket.id}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Comment thread */}
          {comments.map((comment) => {
            const isCustomer = comment.authorRole === "customer";
            const commentAttachments =
              attachmentsByComment.get(comment.id) ?? [];
            const avatar = (
              <div
                className={`size-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                  isCustomer
                    ? "bg-primary text-primary-foreground"
                    : "bg-stone text-white"
                }`}
              >
                {getInitials(comment.authorName)}
              </div>
            );
            return (
              <div
                className={`flex gap-2 ${isCustomer ? "justify-start" : "justify-end"}`}
                key={comment.id}
              >
                {isCustomer && avatar}
                <div
                  className={`max-w-[85%] rounded-xl border p-4 ${
                    comment.isInternal
                      ? "bg-amber-50 border-amber-200"
                      : isCustomer
                        ? "bg-accent border-border"
                        : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {comment.authorName}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {comment.authorRole}
                    </span>
                    {comment.isInternal && (
                      <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
                        <LockSimpleIcon className="size-3" />
                        Internal note
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {formatTicketDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <RichTextContent content={comment.content} />

                  {commentAttachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <DeletableTicketAttachments
                        items={commentAttachments.map((a) => ({
                          id: a.id,
                          url: storage.url(a.storageKey),
                          filename: a.filename,
                          mimeType: a.mimeType,
                          fileSize: a.fileSize,
                        }))}
                        ticketId={ticket.id}
                      />
                    </div>
                  )}
                </div>
                {!isCustomer && avatar}
              </div>
            );
          })}

          {/* Reply form — stays pinned to the bottom of the screen while scrolling.
              The transparent pt-4 on the sticky wrapper keeps a visible gap above
              the card as messages scroll behind it, instead of butting up flush.
              The bg-surface spacer below the card gives it breathing room from the
              true viewport edge WITHOUT leaving a see-through gap — sticky's own
              `bottom` offset would leave a transparent strip there that scrolling
              message content shows through, since sticky elements don't stop the
              page underneath from scrolling. */}
          {isOpen && (
            <div className="sticky bottom-0 z-10 -ml-2 pt-4">
              <div className="bg-card rounded-xl border border-border shadow-soft p-5">
                <AgentReplyForm
                  cannedResponses={cannedResponses}
                  ticketId={ticket.id}
                  totalAttachments={attachments.length}
                />
              </div>
              <div className="h-3 bg-surface" />
            </div>
          )}

          <ScrollToBottomOnMount />
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-16 lg:self-start">
          <TicketInfoSidebar
            activity={activity}
            agents={agents}
            categories={categories}
            currentUserId={session.id}
            isAdmin={session.role === ADMIN_ROLE}
            priorities={priorities}
            statuses={statuses}
            ticket={ticket}
          />
        </div>
      </div>
    </div>
  );
}
