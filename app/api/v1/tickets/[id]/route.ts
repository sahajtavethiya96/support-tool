import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { tickets } from "@/db/schema";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

// GET /api/v1/tickets/:id — public API, authenticated with an API key.
// Any active key can read any ticket — this is a single-tenant, self-hosted
// deployment, so there's no cross-tenant isolation concern to enforce here.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiKey(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;
  const [ticket] = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!ticket) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
