import { and, asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ticketComments, tickets } from "@/db/schema";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { richTextToPlainText } from "@/lib/rich-text";

// GET /api/v1/tickets/:id/comments — public API, authenticated with an API
// key. Read-only conversation thread: public replies only, internal notes
// are never returned (same rule the customer portal itself enforces).
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
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const rows = await db
    .select({
      id: ticketComments.id,
      authorName: ticketComments.authorName,
      authorRole: ticketComments.authorRole,
      content: ticketComments.content,
      createdAt: ticketComments.createdAt,
    })
    .from(ticketComments)
    .where(
      and(eq(ticketComments.ticketId, id), eq(ticketComments.isInternal, false))
    )
    .orderBy(asc(ticketComments.createdAt));

  return NextResponse.json({
    comments: rows.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      authorRole: c.authorRole,
      content: richTextToPlainText(c.content),
      createdAt: c.createdAt,
    })),
  });
}
