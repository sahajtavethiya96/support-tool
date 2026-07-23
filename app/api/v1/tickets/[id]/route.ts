import { and, asc, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { customers, ticketAttachments, tickets } from "@/db/schema";
import { requireApiKey } from "@/lib/api-auth";
import { coerceCustomFieldValue, getCustomFieldValues } from "@/lib/custom-fields";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { richTextToHtml, richTextToPlainText } from "@/lib/rich-text";

// GET /api/v1/tickets/:id — public API, authenticated with an API key.
// Any active key can read any ticket — this is a single-tenant, self-hosted
// deployment, so there's no cross-tenant isolation concern to enforce here.
//
// Returns the customer's opening message (`description`, the one thing the
// conversation thread in /comments does NOT include) plus the customer's
// email/name so an integrating backend can bind a ticket to the account that
// owns it, and the files attached to that opening message (comment_id IS NULL).
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
      description: tickets.description,
      status: tickets.status,
      category: tickets.category,
      priority: tickets.priority,
      customerName: customers.name,
      customerEmail: customers.email,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .where(eq(tickets.id, id))
    .limit(1);

  if (!ticket) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Opening-message attachments have no comment_id (they were attached to the
  // ticket itself at creation, not to any later reply).
  const openingAttachments = await db
    .select({
      id: ticketAttachments.id,
      filename: ticketAttachments.filename,
      fileSize: ticketAttachments.fileSize,
      mimeType: ticketAttachments.mimeType,
    })
    .from(ticketAttachments)
    .where(
      and(
        eq(ticketAttachments.ticketId, id),
        isNull(ticketAttachments.commentId)
      )
    )
    .orderBy(asc(ticketAttachments.createdAt));

  const customFieldValues = await getCustomFieldValues(id);
  const customFields = Object.fromEntries(
    customFieldValues.map((f) => [
      f.key,
      coerceCustomFieldValue(f.type, f.value),
    ])
  );

  return NextResponse.json({
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    status: ticket.status,
    category: ticket.category,
    priority: ticket.priority,
    customerName: ticket.customerName,
    customerEmail: ticket.customerEmail,
    description: richTextToPlainText(ticket.description),
    descriptionHtml: richTextToHtml(ticket.description),
    attachments: openingAttachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      url: `${env.NEXT_PUBLIC_APP_URL}/api/v1/tickets/${id}/attachments/${a.id}`,
    })),
    customFields,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  });
}
