import {
  CaretLeftIcon,
  CaretRightIcon,
  TicketIcon,
} from "@phosphor-icons/react/dist/ssr";
import { and, asc, count, desc, eq, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { TicketsListRealtime } from "@/components/agent/tickets-list-realtime";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import { user } from "@/db/schema/auth";
import { customers } from "@/db/schema/customers";
import { ticketActivity, tickets } from "@/db/schema/tickets";
import { requireAgent } from "@/lib/authz";
import { db } from "@/lib/db";
import { computeSlaSnapshot } from "@/lib/sla";
import { getSlaPolicies, resolveSlaPolicy, type SlaPolicy } from "@/lib/sla-policies";
import { getTicketTagsForTickets } from "@/lib/tags";
import {
  getTicketCategories,
  getTicketPriorities,
  getTicketStatuses,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/ticket-config";
import {
  buildTicketsWhereClause,
  parseTicketListSort,
  SORT_COLUMNS,
  type TicketListSearchParams,
} from "@/lib/tickets-list-query";
import type { ColumnPref } from "@/lib/tickets-table-columns";
import { getTicketTableColumnPrefs } from "@/lib/user-preferences";
import { cn } from "@/lib/utils";
import { ColumnSettingsDialog } from "./_components/column-settings-dialog";
import { GoToPage } from "./_components/go-to-page";
import { PAGE_SIZE_OPTIONS } from "./_components/page-size-options";
import { PageSizeSelect } from "./_components/page-size-select";
import { TicketFilters } from "./_components/ticket-filters";
import { TicketsTable } from "./_components/tickets-table";

export const metadata = { title: "All Tickets" };

const DEFAULT_PAGE_SIZE = 25;

type SearchParams = TicketListSearchParams;

/** Page numbers to render, with "ellipsis" markers where pages are skipped. */
function getPageNumbers(
  current: number,
  total: number
): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total, current]);
  if (current > 1) {
    pages.add(current - 1);
  }
  if (current < total) {
    pages.add(current + 1);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const result: Array<number | "ellipsis"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) {
      result.push("ellipsis");
    }
    result.push(p);
    prev = p;
  }
  return result;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function TicketsPage({ searchParams }: Props) {
  const params = await searchParams;

  const session = await requireAgent();
  const [statuses, categories, priorities, columnPrefs, slaPolicies, agents] =
    await Promise.all([
      getTicketStatuses(),
      getTicketCategories(),
      getTicketPriorities(),
      getTicketTableColumnPrefs(session.id),
      getSlaPolicies(),
      db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(
          and(
            eq(user.banned, false),
            or(eq(user.role, AGENT_ROLE), eq(user.role, ADMIN_ROLE))
          )
        ),
    ]);

  return (
    <div className="p-6 space-y-5">
      <TicketsListRealtime />
      <TicketFilters
        agents={agents}
        categories={categories}
        priorities={priorities}
        statuses={statuses}
      />

      {/* Re-suspends on every search/filter change (key = params), so the table
          skeleton shows while the new results load. */}
      <Suspense
        fallback={<TicketsTableSkeleton />}
        key={JSON.stringify(params)}
      >
        <TicketsResults
          agentId={session.id}
          agents={agents}
          categories={categories}
          columnPrefs={columnPrefs}
          isAdmin={session.role === ADMIN_ROLE}
          params={params}
          priorities={priorities}
          slaPolicies={slaPolicies}
          statuses={statuses}
        />
      </Suspense>
    </div>
  );
}

async function TicketsResults({
  params,
  agentId,
  agents,
  isAdmin,
  statuses,
  categories,
  priorities,
  slaPolicies,
  columnPrefs,
}: {
  params: SearchParams;
  agentId: string;
  agents: Array<{ id: string; name: string | null; email: string }>;
  isAdmin: boolean;
  statuses: TicketStatus[];
  categories: TicketCategory[];
  priorities: TicketPriority[];
  slaPolicies: SlaPolicy[];
  columnPrefs: ColumnPref[];
}) {
  const statusMap = Object.fromEntries(statuses.map((s) => [s.slug, s]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const priorityMap = Object.fromEntries(priorities.map((p) => [p.slug, p]));

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const requestedPageSize = Number.parseInt(params.pageSize ?? "", 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const search = params.q?.trim() ?? "";
  const statusFilter =
    params.status && params.status !== "all" ? params.status : null;
  const categoryFilter =
    params.category && params.category !== "all" ? params.category : null;
  const priorityFilter =
    params.priority && params.priority !== "all" ? params.priority : null;
  const assigneeFilter =
    params.assignee && params.assignee !== "all" ? params.assignee : null;
  const rangeFilter =
    params.range && params.range !== "all" ? params.range : null;
  const awaitingFilter = params.awaiting === "1";
  const mineFilter = params.mine === "1";
  const { sortKey, sortOrder } = parseTicketListSort(params);

  const whereClause = buildTicketsWhereClause(params, agentId);

  const [{ total }] = await db
    .select({ total: count() })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .where(whereClause);

  const rows = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      status: tickets.status,
      category: tickets.category,
      priority: tickets.priority,
      customerName: customers.name,
      assignedAgentId: tickets.assignedAgentId,
      assignedAgentName: user.name,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      closedAt: tickets.closedAt,
      awaitingReply: tickets.awaitingReply,
      waitingSince: tickets.waitingSince,
      firstRespondedAt: tickets.firstRespondedAt,
      slaActiveSeconds: tickets.slaActiveSeconds,
    })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .leftJoin(user, eq(tickets.assignedAgentId, user.id))
    .where(whereClause)
    .orderBy(
      sortOrder === "asc"
        ? asc(SORT_COLUMNS[sortKey])
        : desc(SORT_COLUMNS[sortKey])
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const visibleColumnIds = new Set(
    columnPrefs.filter((c) => c.visible).map((c) => c.id)
  );
  const ticketIds = rows.map((r) => r.id);

  const [tagsByTicket, updatedByRows] = await Promise.all([
    visibleColumnIds.has("tags")
      ? getTicketTagsForTickets(ticketIds)
      : Promise.resolve({} as Record<string, string[]>),
    visibleColumnIds.has("updatedBy") && ticketIds.length > 0
      ? db
          .selectDistinctOn([ticketActivity.ticketId], {
            ticketId: ticketActivity.ticketId,
            actorName: ticketActivity.actorName,
          })
          .from(ticketActivity)
          .where(
            and(
              inArray(ticketActivity.ticketId, ticketIds),
              inArray(ticketActivity.actorRole, [AGENT_ROLE, ADMIN_ROLE])
            )
          )
          .orderBy(ticketActivity.ticketId, desc(ticketActivity.createdAt))
      : Promise.resolve([]),
  ]);
  const updatedByTicket = Object.fromEntries(
    updatedByRows.map((r) => [r.ticketId, r.actorName])
  );

  const slaNow = new Date();
  const rowsWithExtras = rows.map((r) => ({
    ...r,
    tags: tagsByTicket[r.id] ?? [],
    updatedByName: updatedByTicket[r.id] ?? null,
    slaSnapshot: computeSlaSnapshot(
      r,
      resolveSlaPolicy(slaPolicies, r.category, r.priority),
      slaNow
    ),
  }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildPageUrl(p: number) {
    const qp = new URLSearchParams();
    if (search) {
      qp.set("q", search);
    }
    if (statusFilter) {
      qp.set("status", statusFilter);
    }
    if (categoryFilter) {
      qp.set("category", categoryFilter);
    }
    if (priorityFilter) {
      qp.set("priority", priorityFilter);
    }
    if (assigneeFilter) {
      qp.set("assignee", assigneeFilter);
    }
    if (rangeFilter) {
      qp.set("range", rangeFilter);
    }
    if (awaitingFilter) {
      qp.set("awaiting", "1");
    }
    if (mineFilter) {
      qp.set("mine", "1");
    }
    if (sortKey !== "updatedAt") {
      qp.set("sort", sortKey);
    }
    if (sortOrder !== "desc") {
      qp.set("order", sortOrder);
    }
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      qp.set("pageSize", String(pageSize));
    }
    if (p > 1) {
      qp.set("page", String(p));
    }
    const qs = qp.toString();
    return `/tickets${qs ? `?${qs}` : ""}`;
  }

  // Carries the current filter/sort/page state onto each ticket's detail
  // link, so the ticket detail page's Previous/Next buttons can traverse
  // this same filtered result set (see lib/tickets-list-query.ts).
  const listQuery = buildPageUrl(page).slice("/tickets".length);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} ticket{total === 1 ? "" : "s"}
          {search || statusFilter || categoryFilter
            ? " matching your filters"
            : ""}
        </p>
        <ColumnSettingsDialog columns={columnPrefs} />
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-soft flex flex-col items-center justify-center py-20 text-center">
          <TicketIcon className="size-10 text-muted-foreground mb-3" />
          <p className="text-base font-medium text-foreground">
            No tickets found
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || statusFilter || categoryFilter
              ? "Try adjusting your filters."
              : "Customers can submit tickets at your support portal."}
          </p>
        </div>
      ) : (
        <>
          <TicketsTable
            agents={agents}
            categoryMap={categoryMap}
            columnPrefs={columnPrefs}
            isAdmin={isAdmin}
            listQuery={listQuery}
            priorities={priorities}
            priorityMap={priorityMap}
            rows={rowsWithExtras}
            statuses={statuses}
            statusMap={statusMap}
          />

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
                Rows per page
              </span>
              <PageSizeSelect pageSize={pageSize} />
            </div>

            {totalPages > 1 && <GoToPage totalPages={totalPages} />}

            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center gap-1">
                <Link
                  aria-disabled={page <= 1}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 h-8 text-sm font-medium transition-colors",
                    page <= 1
                      ? "pointer-events-none text-muted-foreground/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  href={buildPageUrl(Math.max(1, page - 1))}
                >
                  <CaretLeftIcon className="size-4" />
                  Previous
                </Link>

                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "ellipsis" ? (
                    <span
                      className="inline-flex size-8 items-center justify-center text-sm text-muted-foreground"
                      key={`ellipsis-${
                        // biome-ignore lint/suspicious/noArrayIndexKey: two ellipses can never be adjacent, so index is stable within this static list
                        i
                      }`}
                    >
                      …
                    </span>
                  ) : (
                    <Link
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
                        p === page
                          ? "border border-border bg-card text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                      href={buildPageUrl(p)}
                      key={p}
                    >
                      {p}
                    </Link>
                  )
                )}

                <Link
                  aria-disabled={page >= totalPages}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 h-8 text-sm font-medium transition-colors",
                    page >= totalPages
                      ? "pointer-events-none text-muted-foreground/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  href={buildPageUrl(Math.min(totalPages, page + 1))}
                >
                  Next
                  <CaretRightIcon className="size-4" />
                </Link>
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TicketsTableSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-28" />
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-accent/50 px-4 py-3">
          <Skeleton className="h-3 w-24" />
        </div>
        {/* Rows */}
        <div className="divide-y divide-border/60">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="flex items-center gap-4 px-4 py-3.5" key={i}>
              <Skeleton className="h-3 w-10 shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-xs" />
              <Skeleton className="h-5 w-16 rounded-md shrink-0 hidden sm:block" />
              <Skeleton className="h-5 w-20 rounded-md shrink-0 hidden md:block" />
              <Skeleton className="size-7 rounded-full shrink-0 hidden lg:block" />
              <Skeleton className="h-3 w-16 shrink-0 hidden xl:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
