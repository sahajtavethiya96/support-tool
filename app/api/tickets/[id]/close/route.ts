import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ticketActivity, tickets } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email";
import { ticketClosedTemplate } from "@/lib/email/templates/ticket-closed";
import { env } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getClosedStatus, isClosedStatusSlug } from "@/lib/ticket-config";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params;

  let body: { token?: string } = {};
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    // no body is fine
  }

  const now = new Date();

  // Determine actor
  let actorName: string;
  let actorRole: string;
  let actorId: string | undefined;

  const session = await auth.api.getSession({ headers: request.headers });

  let ticket;
  if (
    session?.user &&
    (session.user.role === "agent" || session.user.role === "admin")
  ) {
    [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    actorId = session.user.id;
    actorName = session.user.name ?? session.user.email;
    actorRole = session.user.role;
  } else if (body.token) {
    const { allowed } = await checkRateLimit({
      action: "ticket_close",
      key: getClientIp(request),
      limit: 20,
      windowMinutes: 10,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    [ticket] = await db
      .select()
      .from(tickets)
      .where(
        and(eq(tickets.id, ticketId), eq(tickets.customerToken, body.token))
      )
      .limit(1);
    if (ticket) {
      actorName = ticket.customerName;
      actorRole = "customer";
    } else {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
  } else {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  if (await isClosedStatusSlug(ticket.status)) {
    return NextResponse.json(
      { error: "Ticket is already closed." },
      { status: 400 }
    );
  }

  const closedStatus = await getClosedStatus();
  if (!closedStatus) {
    return NextResponse.json(
      { error: "No closed status is configured." },
      { status: 400 }
    );
  }

  const previousStatus = ticket.status;

  await db
    .update(tickets)
    // Closing resolves the ticket — it's no longer awaiting a reply.
    .set({
      status: closedStatus.slug,
      closedAt: now,
      updatedAt: now,
      awaitingReply: false,
      pendingReplies: 0,
    })
    .where(eq(tickets.id, ticketId));

  await db.insert(ticketActivity).values({
    id: createId(),
    ticketId,
    actorId: actorId ?? null,
    actorName,
    actorRole,
    action: "ticket_closed",
    metadata: { from: previousStatus, to: closedStatus.slug },
    createdAt: now,
  });

  // Notify customer on close
  const ticketUrl = `${env.NEXT_PUBLIC_APP_URL}/ticket/${ticketId}?token=${ticket.customerToken}`;
  ticketClosedTemplate({
    customerName: ticket.customerName,
    ticketNumber: ticket.ticketNumber,
    ticketSubject: ticket.subject,
    ticketUrl,
  })
    .then(({ html, text }) =>
      enqueueEmail({
        to: ticket.customerEmail,
        subject: `[#${ticket.ticketNumber}] Your ticket has been closed — ${ticket.subject}`,
        html,
        text,
      })
    )
    .catch((err) => console.error("[ticket.closed email]", err));

  return NextResponse.json({ status: closedStatus.slug });
}
