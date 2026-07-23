import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { getTicketsByPriorityReport, parseReportRange } from "@/lib/reports";

// GET /api/admin/reports/by-priority/csv?range=30d|90d|all — admin only.
export async function GET(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const range = parseReportRange(request.nextUrl.searchParams.get("range"));
  const rows = await getTicketsByPriorityReport(range);

  const csv = toCsv(
    rows.map((r) => ({
      priority: r.label,
      count: r.count,
      share: `${(r.share * 100).toFixed(1)}%`,
    })),
    [
      { key: "priority", label: "Priority" },
      { key: "count", label: "Tickets" },
      { key: "share", label: "Share" },
    ]
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="tickets-by-priority-${range}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
