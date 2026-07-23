import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { requireAdminFromRequest } from "@/lib/authz";
import { getTicketsByAgentReport, parseReportRange } from "@/lib/reports";

// GET /api/admin/reports/by-agent/csv?range=30d|90d|all — admin only.
export async function GET(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const range = parseReportRange(request.nextUrl.searchParams.get("range"));
  const rows = await getTicketsByAgentReport(range);

  const csv = toCsv(
    rows.map((r) => ({
      agent: r.agentName,
      totalTickets: r.totalTickets,
      openTickets: r.openTickets,
      avgFirstResponseSeconds: r.avgFirstResponseSeconds ?? "",
      avgResolutionSeconds: r.avgResolutionSeconds ?? "",
    })),
    [
      { key: "agent", label: "Agent" },
      { key: "totalTickets", label: "Total Tickets" },
      { key: "openTickets", label: "Open Tickets" },
      { key: "avgFirstResponseSeconds", label: "Avg First Response (seconds)" },
      { key: "avgResolutionSeconds", label: "Avg Resolution (seconds)" },
    ]
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="tickets-by-agent-${range}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
