import {
  ArrowLeftIcon,
  CaretLeftIcon,
  CaretRightIcon,
  LockSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketDetailRealtime } from "@/components/agent/ticket-detail-realtime";
import { DeletableTicketAttachments } from "@/components/common/deletable-ticket-attachments";
import { LocalDateTime } from "@/components/common/local-datetime";
import { RichTextContent } from "@/components/common/rich-text-content";
import { ScrollToBottomOnMount } from "@/components/common/scroll-to-bottom-on-mount";
import { ADMIN_ROLE } from "@/config/platform";
import { user } from "@/db/schema/auth";
import { customers } from "@/db/schema/customers";
import {
  ticketActivity,
  ticketAttachments,
  ticketComments,
  tickets,
} from "@/db/schema/tickets";
import { requireAgent } from "@/lib/authz";
import { getCannedResponses } from "@/lib/canned-responses";
import { getCustomFieldValues } from "@/lib/custom-fields";
import { db } from "@/lib/db";
import { isRichTextEmpty } from "@/lib/rich-text";
import { computeSlaSnapshot } from "@/lib/sla";
import { getSlaPolicies, resolveSlaPolicy } from "@/lib/sla-policies";
import { storage } from "@/lib/storage";
import { getTicketTags } from "@/lib/tags";
import {
  getTicketCategories,
  getTicketPriorities,
  getTicketStatuses,
} from "@/lib/ticket-config";
import { COLOR_BADGE } from "@/lib/tickets";
import {
  buildTicketsWhereClause,
  parseTicketListSort,
  type SortKey,
  type TicketListSearchParams,
  toQueryString,
} from "@/lib/tickets-list-query";
import { getInitials } from "@/lib/utils";
import { AgentReplyForm } from "./_components/agent-reply-form";
import { CustomerProfilePopover } from "./_components/customer-profile-popover";
import { TicketInfoSidebar } from "./_components/ticket-info-sidebar";

interface Props {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<TicketListSearchParams>;
}

/** The neighbor strictly before/after `current` within the same filtered,
 * sorted result set the agent came from — a keyset ("seek") comparison
 * against (sortKey, ticketNumber) rather than loading the whole list, so
 * this stays cheap regardless of list size and works across page boundaries. */
async function getAdjacentTicketId(
  direction: "prev" | "next",
  whereClause: ReturnType<typeof buildTicketsWhereClause>,
  sortKey: SortKey,
  sortOrder: "asc" | "desc",
  current: { ticketNumber: number; updatedAt: Date }
): Promise<string | null> {
  const wantsGreater =
    direction === "next" ? sortOrder === "asc" : sortOrder === "desc";

  const seekCondition =
    sortKey === "id"
      ? wantsGreater
        ? gt(tickets.ticketNumber, current.ticketNumber)
        : lt(tickets.ticketNumber, current.ticketNumber)
      : or(
          wantsGreater
            ? gt(tickets.updatedAt, current.updatedAt)
            : lt(tickets.updatedAt, current.updatedAt),
          and(
            eq(tickets.updatedAt, current.updatedAt),
            wantsGreater
              ? gt(tickets.ticketNumber, current.ticketNumber)
              : lt(tickets.ticketNumber, current.ticketNumber)
          )
        );

  const where = whereClause ? and(whereClause, seekCondition) : seekCondition;
  const resultOrder = wantsGreater ? asc : desc;

  const [row] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .where(where)
    .orderBy(
      ...(sortKey === "id"
        ? [resultOrder(tickets.ticketNumber)]
        : [resultOrder(tickets.updatedAt), resultOrder(tickets.ticketNumber)])
    )
    .limit(1);

  return row?.id ?? null;
}

function TicketNavLink({
  ticketId,
  listQuery,
  direction,
}: {
  ticketId: string | null;
  listQuery: string;
  direction: "prev" | "next";
}) {
  const Icon = direction === "prev" ? CaretLeftIcon : CaretRightIcon;
  const label = direction === "prev" ? "Previous ticket" : "Next ticket";
  const className =
    "inline-flex size-7 items-center justify-center rounded-md border transition-colors";

  if (!ticketId) {
    return (
      <button
        aria-label={label}
        className={`${className} cursor-not-allowed border-border/50 text-muted-foreground/40`}
        disabled
        title={label}
        type="button"
      >
        <Icon className="size-4" />
      </button>
    );
  }

  return (
    <Link
      aria-label={label}
      className={`${className} border-border text-foreground hover:bg-accent`}
      href={`/tickets/${ticketId}${listQuery}`}
      title={label}
    >
      <Icon className="size-4" />
    </Link>
  );
}

export default async function AgentTicketDetailPage({
  params,
  searchParams,
}: Props) {
  const { ticketId } = await params;
  const listParams = await searchParams;
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
      customerId: tickets.customerId,
      customerName: customers.name,
      customerEmail: customers.email,
      assignedAgentId: tickets.assignedAgentId,
      closedAt: tickets.closedAt,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      awaitingReply: tickets.awaitingReply,
      waitingSince: tickets.waitingSince,
      firstRespondedAt: tickets.firstRespondedAt,
      slaActiveSeconds: tickets.slaActiveSeconds,
    })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) {
    notFound();
  }

  // Reconstructs the same filtered/sorted result set the agent came from
  // (see lib/tickets-list-query.ts) so Previous/Next stay within that queue.
  const listWhereClause = buildTicketsWhereClause(listParams, session.id);
  const { sortKey, sortOrder } = parseTicketListSort(listParams);
  const listQuery = toQueryString(listParams);

  const [
    statuses,
    categories,
    priorities,
    slaPolicies,
    cannedResponses,
    tags,
    customFields,
    prevTicketId,
    nextTicketId,
  ] = await Promise.all([
    getTicketStatuses(),
    getTicketCategories(),
    getTicketPriorities(),
    getSlaPolicies(),
    getCannedResponses(),
    getTicketTags(ticketId),
    getCustomFieldValues(ticketId),
    getAdjacentTicketId("prev", listWhereClause, sortKey, sortOrder, ticket),
    getAdjacentTicketId("next", listWhereClause, sortKey, sortOrder, ticket),
  ]);

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
    .orderBy(desc(ticketActivity.createdAt));

  // Agents for assignment dropdown
  const agents = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.banned, false)));

  const isOpen = !(statusMap[ticket.status]?.isClosedState ?? false);

  const slaSnapshot = computeSlaSnapshot(
    ticket,
    resolveSlaPolicy(slaPolicies, ticket.category, ticket.priority),
    new Date()
  );

  return (
    <div className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <TicketDetailRealtime ticketId={ticket.id} />
      {/* Breadcrumb — stays pinned to the top of the scroll area, carrying the
          ticket's subject + status along so context stays visible while
          scrolled away from the ticket header card below. */}
      <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-4 lg:px-8">
        <Link
          className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          href={`/tickets${listQuery}`}
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
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1">
            <TicketNavLink
              direction="prev"
              listQuery={listQuery}
              ticketId={prevTicketId}
            />
            <TicketNavLink
              direction="next"
              listQuery={listQuery}
              ticketId={nextTicketId}
            />
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded border px-2.5 py-1 text-xs font-medium ${COLOR_BADGE[statusMap[ticket.status]?.color ?? "slate"] ?? ""}`}
          >
            {statusMap[ticket.status]?.label ?? ticket.status}
          </span>
        </div>
      </div>

      {/* Two-column row — no gap and no padding on the row itself (Kanbanica
          structure): the divider is the sidebar's own border-l sitting flush
          against the main column, and all padding lives INSIDE each scroll
          container so scrollbars sit at the column edges, not floating in a
          gap. */}
      <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch lg:gap-0">
        {/* ── Main panel ── a full-height flex column: the message thread
            scrolls in the inner container, while the reply form below is pinned
            static at the bottom (Slack-style) and never scrolls. */}
        <div className="flex w-full min-w-0 flex-col lg:min-h-0 lg:flex-1">
          {/* Scrollable message thread — padding lives inside so the scrollbar
              sits at the column edge, flush to the sidebar divider. */}
          <div className="space-y-4 overflow-x-hidden px-4 py-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8 lg:py-6">
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
                      <LocalDateTime date={ticket.createdAt} />
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
              <CustomerProfilePopover
                currentTicketId={ticket.id}
                customerEmail={ticket.customerEmail}
                customerId={ticket.customerId}
                customerName={ticket.customerName}
              >
                <button
                  className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0"
                  type="button"
                >
                  {getInitials(ticket.customerName)}
                </button>
              </CustomerProfilePopover>
              <div className="min-w-0 max-w-[85%] wrap-break-word bg-accent rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {ticket.customerName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Customer
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    <LocalDateTime date={ticket.createdAt} />
                  </span>
                </div>
                {!isRichTextEmpty(ticket.description) && (
                  <RichTextContent content={ticket.description} />
                )}
                {ticketLevelAttachments.length > 0 && (
                  <div
                    className={
                      isRichTextEmpty(ticket.description)
                        ? ""
                        : "mt-4 pt-4 border-t border-border"
                    }
                  >
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
              const avatarClassName = `size-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                isCustomer
                  ? "bg-primary text-primary-foreground"
                  : "bg-stone text-white"
              }`;
              const avatar = isCustomer ? (
                <CustomerProfilePopover
                  currentTicketId={ticket.id}
                  customerEmail={ticket.customerEmail}
                  customerId={ticket.customerId}
                  customerName={ticket.customerName}
                >
                  <button className={avatarClassName} type="button">
                    {getInitials(comment.authorName)}
                  </button>
                </CustomerProfilePopover>
              ) : (
                <div className={avatarClassName}>
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
                    className={`min-w-0 max-w-[85%] wrap-break-word rounded-xl border p-4 ${
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
                      {comment.isInternal && (
                        <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
                          <LockSimpleIcon className="size-3" />
                          Internal note
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        <LocalDateTime date={comment.createdAt} />
                      </span>
                    </div>
                    {!isRichTextEmpty(comment.content) && (
                      <RichTextContent content={comment.content} />
                    )}

                    {commentAttachments.length > 0 && (
                      <div
                        className={
                          isRichTextEmpty(comment.content)
                            ? ""
                            : "mt-3 pt-3 border-t border-border"
                        }
                      >
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

            <ScrollToBottomOnMount />
          </div>

          {/* Reply form — pinned static at the bottom of the panel (Slack-style):
              a shrink-0 sibling OUTSIDE the scroll area, so it never moves while
              the messages scroll above it. Same horizontal padding as the
              thread so it stays aligned. */}
          {isOpen && (
            <div className="shrink-0 px-4 pb-4 pt-2 lg:px-8 lg:pb-6">
              <AgentReplyForm
                cannedResponses={cannedResponses}
                ticketId={ticket.id}
                totalAttachments={attachments.length}
              />
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-full shrink-0 px-4 pb-5 lg:w-72 lg:sticky lg:top-12 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-border lg:px-6 lg:py-6">
          <TicketInfoSidebar
            activity={activity}
            agents={agents}
            categories={categories}
            currentUserId={session.id}
            customFields={customFields}
            isAdmin={session.role === ADMIN_ROLE}
            priorities={priorities}
            slaSnapshot={slaSnapshot}
            statuses={statuses}
            tags={tags}
            ticket={ticket}
          />
        </div>
      </div>
    </div>
  );
}
