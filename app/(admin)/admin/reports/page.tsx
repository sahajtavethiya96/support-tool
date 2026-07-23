import { requireAdmin } from "@/lib/authz";
import {
  getTicketsByAgentReport,
  getTicketsByCategoryReport,
  getTicketsByPriorityReport,
  getTicketsByTagReport,
  parseReportRange,
  tagReportLimit,
  type ReportRange,
} from "@/lib/reports";
import { AgentReportTable } from "./_components/agent-report-table";
import { BreakdownReportTable } from "./_components/breakdown-report-table";

export const metadata = { title: "Reports" };

interface Props {
  searchParams: Promise<{ range?: string }>;
}

const RANGE_OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default async function ReportsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const range = parseReportRange(params.range ?? null);

  const [agentRows, categoryRows, priorityRows, tagRows] = await Promise.all([
    getTicketsByAgentReport(range),
    getTicketsByCategoryReport(range),
    getTicketsByPriorityReport(range),
    getTicketsByTagReport(range),
  ]);

  function rangeHref(value: ReportRange) {
    return value === "30d" ? "/admin/reports" : `/admin/reports?range=${value}`;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Who's busy, how fast the team responds, and what tickets are
            about.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          {RANGE_OPTIONS.map((opt) => (
            <a
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                range === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              href={rangeHref(opt.value)}
              key={opt.value}
            >
              {opt.label}
            </a>
          ))}
        </div>
      </div>

      <AgentReportTable
        csvHref={`/api/admin/reports/by-agent/csv?range=${range}`}
        rows={agentRows}
      />

      <BreakdownReportTable
        csvHref={`/api/admin/reports/by-category/csv?range=${range}`}
        rows={categoryRows.map((r) => ({
          label: r.label,
          count: r.count,
          share: r.share,
        }))}
        title="Tickets by Category"
      />

      <BreakdownReportTable
        csvHref={`/api/admin/reports/by-priority/csv?range=${range}`}
        rows={priorityRows.map((r) => ({
          label: r.label,
          count: r.count,
          share: r.share,
        }))}
        title="Tickets by Priority"
      />

      <BreakdownReportTable
        csvHref={`/api/admin/reports/by-tag/csv?range=${range}`}
        description={`Top ${tagReportLimit} tags by ticket count`}
        rows={tagRows.map((r) => ({ label: r.name, count: r.count }))}
        title="Tickets by Tag"
      />
    </div>
  );
}
