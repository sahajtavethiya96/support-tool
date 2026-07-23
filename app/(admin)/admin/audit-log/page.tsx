import {
  CaretLeftIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
} from "@phosphor-icons/react/dist/ssr";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { auditLogs } from "@/db/schema";
import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { AuditLogFilters } from "./_components/audit-log-filters";
import { AuditLogTable } from "./_components/audit-log-table";

type SearchParams = { q?: string; action?: string; page?: string };

interface Props {
  searchParams: Promise<SearchParams>;
}

const PAGE_SIZE = 25;

export default async function AuditLogPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  // Derived from the data itself (not a hand-maintained list) so the filter
  // never goes stale as new audit() call sites are added elsewhere in the
  // codebase — see docs/plans/07-audit-log-viewer.md.
  const availableActions = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(asc(auditLogs.action));

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <AuditLogFilters actions={availableActions.map((a) => a.action)} />

      <Suspense
        fallback={<AuditLogTableSkeleton />}
        key={JSON.stringify(params)}
      >
        <AuditLogResults params={params} />
      </Suspense>
    </div>
  );
}

async function AuditLogResults({ params }: { params: SearchParams }) {
  const search = (params.q ?? "").trim();
  const action = (params.action ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(auditLogs.description, `%${search}%`),
        ilike(auditLogs.actorEmail, `%${search}%`)
      )
    );
  }
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);

  const pageCount = Math.ceil(total / PAGE_SIZE);

  function buildPageUrl(p: number) {
    const qp = new URLSearchParams();
    if (search) {
      qp.set("q", search);
    }
    if (action) {
      qp.set("action", action);
    }
    if (p > 1) {
      qp.set("page", String(p));
    }
    const qs = qp.toString();
    return `/admin/audit-log${qs ? `?${qs}` : ""}`;
  }

  const tableRows = rows.map((r) => ({
    action: r.action,
    actorEmail: r.actorEmail,
    createdAt: r.createdAt.toISOString(),
    description: r.description,
    entityId: r.entityId,
    entityType: r.entityType,
    id: r.id,
    metadata: r.metadata ?? null,
  }));

  return (
    <>
      <p className="text-xs text-muted-foreground">
        {total} event{total === 1 ? "" : "s"}
      </p>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {tableRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClockCounterClockwiseIcon className="size-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">
              No events found
            </p>
            {(search || action) && (
              <p className="text-xs text-muted-foreground mt-1">
                Try a different search term or filter
              </p>
            )}
          </div>
        ) : (
          <AuditLogTable rows={tableRows} />
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pageCount} · {total} events
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildPageUrl(page - 1)}>
                <Button
                  className="h-8 gap-1 border-border text-foreground hover:bg-accent"
                  size="sm"
                  variant="outline"
                >
                  <CaretLeftIcon className="size-3" />
                  Previous
                </Button>
              </Link>
            )}
            {page < pageCount && (
              <Link href={buildPageUrl(page + 1)}>
                <Button
                  className="h-8 gap-1 border-border text-foreground hover:bg-accent"
                  size="sm"
                  variant="outline"
                >
                  Next
                  <CaretRightIcon className="size-3" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AuditLogTableSkeleton() {
  return (
    <>
      <Skeleton className="h-3 w-24 mb-3" />
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="border-b border-border bg-accent/50 px-4 py-3">
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="divide-y divide-border/50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="flex items-center gap-4 px-4 py-3.5" key={i}>
              <Skeleton className="h-3 w-24 shrink-0" />
              <Skeleton className="h-3 w-32 shrink-0 hidden sm:block" />
              <Skeleton className="h-5 w-24 rounded-md shrink-0" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
