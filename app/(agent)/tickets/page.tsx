import {
  CaretLeftIcon,
  CaretRightIcon,
  TicketIcon,
} from "@phosphor-icons/react/dist/ssr";
import { and, count, desc, eq, gte, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { TicketsListRealtime } from "@/components/agent/tickets-list-realtime";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import { user } from "@/db/schema/auth";
import { tickets } from "@/db/schema/tickets";
import { requireAgent } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  getTicketCategories,
  getTicketPriorities,
  getTicketStatuses,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/ticket-config";
import { cn } from "@/lib/utils";
import { GoToPage } from "./_components/go-to-page";
import { PAGE_SIZE_OPTIONS } from "./_components/page-size-options";
import { PageSizeSelect } from "./_components/page-size-select";
import { TicketFilters } from "./_components/ticket-filters";
import { TicketsTable } from "./_components/tickets-table";

export const metadata = { title: "All Tickets" };

const DEFAULT_PAGE_SIZE = 25;

type SearchParams = {
  q?: string;
  status?: string;
  category?: string;
  priority?: string;
  range?: string;
  awaiting?: string;
  mine?: string;
  page?: string;
  pageSize?: string;
};

const RANGE_DAYS: Record<string, number> = {
  last_day: 1,
  last_week: 7,
};

function getRangeStart(range: string | null): Date | null {
  if (!range) {
    return null;
  }
  if (range === "this_month") {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const days = RANGE_DAYS[range];
  if (!days) {
    return null;
  }
  const start = new Date();
  start.setDate(start.getDate() - days);
  return start;
}

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

  const [session, statuses, categories, priorities] = await Promise.all([
    requireAgent(),
    getTicketStatuses(),
    getTicketCategories(),
    getTicketPriorities(),
  ]);

  return (
    <div className="p-6 space-y-5">
      <TicketsListRealtime />
      <TicketFilters
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
          categories={categories}
          isAdmin={session.role === ADMIN_ROLE}
          params={params}
          priorities={priorities}
          statuses={statuses}
        />
      </Suspense>
    </div>
  );
}

async function TicketsResults({
  params,
  agentId,
  isAdmin,
  statuses,
  categories,
  priorities,
}: {
  params: SearchParams;
  agentId: string;
  isAdmin: boolean;
  statuses: TicketStatus[];
  categories: TicketCategory[];
  priorities: TicketPriority[];
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
  const rangeFilter =
    params.range && params.range !== "all" ? params.range : null;
  const awaitingFilter = params.awaiting === "1";
  const mineFilter = params.mine === "1";

  // Build where conditions
  const conditions = [];
  if (search) {
    const numSearch = Number.parseInt(search.replace("#", ""), 10);
    const textConditions = [
      ilike(tickets.subject, `%${search}%`),
      ilike(tickets.customerName, `%${search}%`),
      ilike(tickets.customerEmail, `%${search}%`),
    ];
    if (!isNaN(numSearch)) {
      textConditions.push(eq(tickets.ticketNumber, numSearch) as never);
    }
    conditions.push(or(...textConditions));
  }
  if (statusFilter) {
    conditions.push(eq(tickets.status, statusFilter));
  }
  if (categoryFilter) {
    conditions.push(eq(tickets.category, categoryFilter));
  }
  if (priorityFilter) {
    conditions.push(eq(tickets.priority, priorityFilter));
  }
  const rangeStart = getRangeStart(rangeFilter);
  if (rangeStart) {
    conditions.push(gte(tickets.createdAt, rangeStart));
  }
  if (awaitingFilter) {
    conditions.push(eq(tickets.awaitingReply, true));
  }
  if (mineFilter) {
    conditions.push(eq(tickets.assignedAgentId, agentId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(tickets)
    .where(whereClause);

  const rows = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      status: tickets.status,
      category: tickets.category,
      priority: tickets.priority,
      customerName: tickets.customerName,
      assignedAgentId: tickets.assignedAgentId,
      assignedAgentName: user.name,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(user, eq(tickets.assignedAgentId, user.id))
    .where(whereClause)
    .orderBy(desc(tickets.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Needed for the per-row and bulk-assign (admin only) assignee pickers.
  const agents = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(
      and(
        eq(user.banned, false),
        or(eq(user.role, AGENT_ROLE), eq(user.role, ADMIN_ROLE))
      )
    );

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
    if (rangeFilter) {
      qp.set("range", rangeFilter);
    }
    if (awaitingFilter) {
      qp.set("awaiting", "1");
    }
    if (mineFilter) {
      qp.set("mine", "1");
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

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {total} ticket{total === 1 ? "" : "s"}
        {search || statusFilter || categoryFilter
          ? " matching your filters"
          : ""}
      </p>

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
            isAdmin={isAdmin}
            priorities={priorities}
            priorityMap={priorityMap}
            rows={rows}
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
