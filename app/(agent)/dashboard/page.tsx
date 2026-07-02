import { count, sql, desc, eq, and, inArray, gte } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import {
  TicketIcon,
  HourglassIcon,
  ArrowsClockwiseIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets } from "@/db/schema/tickets";
import { user } from "@/db/schema/auth";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import { VolumeChart } from "./_components/volume-chart";
import { redirect } from "next/navigation";
import { getTicketCategories, getTicketStatuses } from "@/lib/ticket-config";
import { COLOR_BADGE } from "@/lib/tickets";

export const metadata = { title: "Dashboard" };

function formatWait(ms: number): string {
  const s = ms / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(s / 86400);
  return `${d}d`;
}

function formatAvgWait(ms: number): string {
  const s = ms / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  if (session.user.role !== AGENT_ROLE && session.user.role !== ADMIN_ROLE) redirect("/login");

  const now = Date.now();

  const [dbStatuses, dbCategories] = await Promise.all([
    getTicketStatuses(),
    getTicketCategories(),
  ]);

  const statusMap = Object.fromEntries(dbStatuses.map((s) => [s.slug, s]));
  const categoryMap = Object.fromEntries(dbCategories.map((c) => [c.slug, c]));

  // ── Status buckets (derived from dynamic status flags) ──────────────────
  // Open = the default status, Closed = any closed-state status,
  // In Progress = everything in between. Generalises the old fixed 3 statuses.
  const closedSlugs = new Set(dbStatuses.filter((s) => s.isClosedState).map((s) => s.slug));
  const defaultSlug = dbStatuses.find((s) => s.isDefault)?.slug;
  const nonClosedSlugs = dbStatuses.filter((s) => !s.isClosedState).map((s) => s.slug);

  // ── Overview stats ──────────────────────────────────────────────────────
  const statusCounts = await db
    .select({ status: tickets.status, c: count() })
    .from(tickets)
    .groupBy(tickets.status);

  let open = 0;
  let inProgress = 0;
  let closed = 0;
  let total = 0;
  for (const row of statusCounts) {
    const c = Number(row.c);
    total += c;
    if (closedSlugs.has(row.status)) closed += c;
    else if (row.status === defaultSlug) open += c;
    else inProgress += c;
  }

  // Average wait across the open (non-closed) queue.
  const [waitRow] = nonClosedSlugs.length
    ? await db
        .select({
          avgWaitSeconds: sql<number | null>`EXTRACT(EPOCH FROM AVG(NOW() - ${tickets.createdAt}))`,
        })
        .from(tickets)
        .where(inArray(tickets.status, nonClosedSlugs))
    : [{ avgWaitSeconds: null }];

  const stats = {
    total,
    open,
    inProgress,
    closed,
    avgWaitMs: waitRow.avgWaitSeconds != null ? Number(waitRow.avgWaitSeconds) * 1000 : null,
  };

  // ── 7-day volume (initial data for chart) ──────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const volumeRows = await db
    .select({
      date: sql<string>`DATE(${tickets.createdAt})::text`,
      count: count(),
    })
    .from(tickets)
    .where(gte(tickets.createdAt, sevenDaysAgo))
    .groupBy(sql`DATE(${tickets.createdAt})`)
    .orderBy(sql`DATE(${tickets.createdAt})`);

  const volumeMap = new Map(volumeRows.map((r) => [r.date, Number(r.count)]));
  const initialVolumeData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: volumeMap.get(key) ?? 0 };
  });

  // ── Recent open tickets (last 10 by updatedAt) ─────────────────────────
  const recentTickets = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      category: tickets.category,
      createdAt: tickets.createdAt,
      agentName: user.name,
    })
    .from(tickets)
    .leftJoin(user, eq(tickets.assignedAgentId, user.id))
    .where(nonClosedSlugs.length ? inArray(tickets.status, nonClosedSlugs) : sql`false`)
    .orderBy(desc(tickets.updatedAt))
    .limit(10);

  // ── My tickets (assigned to me, open + in_progress) ────────────────────
  const myTickets = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      category: tickets.category,
      status: tickets.status,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.assignedAgentId, session.user.id),
        nonClosedSlugs.length ? inArray(tickets.status, nonClosedSlugs) : sql`false`
      )
    )
    .orderBy(desc(tickets.updatedAt))
    .limit(10);

  const statCards = [
    {
      label: "Total Tickets",
      value: stats.total,
      sub: "All time",
      icon: TicketIcon,
      color: "text-foreground",
      bg: "bg-primary/8",
    },
    {
      label: "Open",
      value: stats.open,
      sub: stats.avgWaitMs != null ? `Avg. wait: ${formatAvgWait(stats.avgWaitMs)}` : "No open tickets",
      icon: HourglassIcon,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      sub: "Being handled",
      icon: ArrowsClockwiseIcon,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Closed",
      value: stats.closed,
      sub: "Resolved",
      icon: CheckCircleIcon,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Support queue overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border shadow-soft p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`${card.bg} rounded-lg p-2`}>
                <card.icon className={`size-5 ${card.color}`} weight="duotone" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{card.label}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Volume chart */}
      <VolumeChart initialData={initialVolumeData} />

      {/* Recent open tickets */}
      <div className="bg-card rounded-xl border border-border shadow-soft">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Recent Open Tickets</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 10 open tickets by activity</p>
        </div>
        {recentTickets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No open tickets. Great work!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Waiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-6 py-3 text-muted-foreground font-mono text-xs">#{t.ticketNumber}</td>
                    <td className="px-6 py-3 max-w-xs">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="text-foreground font-medium hover:underline truncate block"
                      >
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/30 text-foreground">
                        {categoryMap[t.category]?.label ?? t.category}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground text-xs">
                      {t.agentName ?? <span className="italic text-muted-foreground/50">Unassigned</span>}
                    </td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">
                      {formatWait(now - t.createdAt.getTime())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {recentTickets.length > 0 && (
          <div className="px-6 py-3 border-t border-border">
            <Link href="/tickets" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all open tickets →
            </Link>
          </div>
        )}
      </div>

      {/* My tickets */}
      <div className="bg-card rounded-xl border border-border shadow-soft">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">My Tickets</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Open and in-progress tickets assigned to you</p>
        </div>
        {myTickets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No tickets assigned to you.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Waiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-6 py-3 text-muted-foreground font-mono text-xs">#{t.ticketNumber}</td>
                    <td className="px-6 py-3 max-w-xs">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="text-foreground font-medium hover:underline truncate block"
                      >
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/30 text-foreground">
                        {categoryMap[t.category]?.label ?? t.category}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${COLOR_BADGE[statusMap[t.status]?.color ?? "slate"] ?? ""}`}
                      >
                        {statusMap[t.status]?.label ?? t.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">
                      {formatWait(now - t.createdAt.getTime())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
