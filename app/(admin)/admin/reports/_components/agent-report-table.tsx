import { formatDuration } from "@/lib/sla";
import type { AgentReportRow } from "@/lib/reports";

interface Props {
  csvHref: string;
  rows: AgentReportRow[];
}

export function AgentReportTable({ rows, csvHref }: Props) {
  return (
    <section className="bg-card rounded-xl border border-border shadow-soft">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Tickets per Agent
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Counts by current assignee, plus average reply/resolution speed
          </p>
        </div>
        <a
          className="text-xs font-medium text-foreground hover:underline shrink-0"
          download
          href={csvHref}
        >
          Download CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No tickets in this range.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Open
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Avg First Response
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Avg Resolution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr
                  className="hover:bg-accent/30 transition-colors"
                  key={r.agentId ?? "unassigned"}
                >
                  <td className="px-6 py-3 text-foreground font-medium">
                    {r.agentId ? (
                      r.agentName
                    ) : (
                      <span className="italic text-muted-foreground/70 font-normal">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {r.totalTickets}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {r.openTickets}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {r.avgFirstResponseSeconds == null
                      ? "—"
                      : formatDuration(r.avgFirstResponseSeconds)}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {r.avgResolutionSeconds == null
                      ? "—"
                      : formatDuration(r.avgResolutionSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
