import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { getTicketsByTagReport, parseReportRange } from "@/lib/reports";

// GET /api/admin/reports/by-tag/csv?range=30d|90d|all — admin only.
// Same top-N cap as the on-page report (lib/reports.ts's tagReportLimit).
export async function GET(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const range = parseReportRange(request.nextUrl.searchParams.get("range"));
  const rows = await getTicketsByTagReport(range);

  const csv = toCsv(
    rows.map((r) => ({ name: r.name, count: r.count })),
    [
      { key: "name", label: "Tag" },
      { key: "count", label: "Tickets" },
    ]
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="tickets-by-tag-${range}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
