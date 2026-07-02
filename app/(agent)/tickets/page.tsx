import { TicketIcon } from "@phosphor-icons/react/dist/ssr";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { TicketsListRealtime } from "@/components/agent/tickets-list-realtime";
import { Button } from "@/components/ui/button";
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
import { TicketFilters } from "./_components/ticket-filters";
import { TicketsTable } from "./_components/tickets-table";

export const metadata = { title: "All Tickets" };

const PAGE_SIZE = 25;

type SearchParams = {
  q?: string;
  status?: string;
  category?: string;
  priority?: string;
  awaiting?: string;
  mine?: string;
  page?: string;
};

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
  const search = params.q?.trim() ?? "";
  const statusFilter =
    params.status && params.status !== "all" ? params.status : null;
  const categoryFilter =
    params.category && params.category !== "all" ? params.category : null;
  const priorityFilter =
    params.priority && params.priority !== "all" ? params.priority : null;
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
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Only needed for the bulk-assign picker, which only admins see.
  const agents = isAdmin
    ? await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(
          and(
            eq(user.banned, false),
            or(eq(user.role, AGENT_ROLE), eq(user.role, ADMIN_ROLE))
          )
        )
    : [];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
    if (awaitingFilter) {
      qp.set("awaiting", "1");
    }
    if (mineFilter) {
      qp.set("mine", "1");
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
            priorityMap={priorityMap}
            rows={rows}
            statuses={statuses}
            statusMap={statusMap}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground text-xs">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button
                    asChild
                    className="border-border text-foreground hover:bg-accent"
                    size="sm"
                    variant="outline"
                  >
                    <Link href={buildPageUrl(page - 1)}>Previous</Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button
                    asChild
                    className="border-border text-foreground hover:bg-accent"
                    size="sm"
                    variant="outline"
                  >
                    <Link href={buildPageUrl(page + 1)}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
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
