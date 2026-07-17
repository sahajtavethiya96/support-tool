import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_ROLE } from "@/config/platform";
import { ticketActivity, ticketAttachments, tickets } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getTicketTags } from "@/lib/tags";
import {
  getTicketCategories,
  getTicketPriorities,
  getTicketStatuses,
} from "@/lib/ticket-config";

async function requireAgentSession(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return null;
  }
  if (session.user.role !== "agent" && session.user.role !== "admin") {
    return null;
  }
  return session;
}

// GET /api/tickets/[id] — agent view (no customerToken)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAgentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const [ticket] = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      description: tickets.description,
      category: tickets.category,
      status: tickets.status,
      priority: tickets.priority,
      customerName: tickets.customerName,
      customerEmail: tickets.customerEmail,
      assignedAgentId: tickets.assignedAgentId,
      closedAt: tickets.closedAt,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!ticket) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const tags = await getTicketTags(id);
  return NextResponse.json({ ...ticket, tags });
}

// PATCH /api/tickets/[id] — update status, category, or assignedAgentId
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAgentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: ticketId } = await params;
  let body: {
    status?: string;
    category?: string;
    priority?: string;
    assignedAgentId?: string | null;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const actorId = session.user.id;
  const actorName = session.user.name ?? session.user.email;
  const actorRole = session.user.role!;
  const now = new Date();

  let changed = false;

  // Status change
  if (body.status !== undefined && body.status !== ticket.status) {
    const validStatuses = await getTicketStatuses();
    const statusRow = validStatuses.find((s) => s.slug === body.status);
    if (!statusRow) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const previousStatus = ticket.status;
    const newStatus = body.status;

    await db
      .update(tickets)
      .set({
        status: newStatus,
        closedAt: statusRow.isClosedState ? now : null,
        updatedAt: now,
      })
      .where(eq(tickets.id, ticketId));

    await db.insert(ticketActivity).values({
      id: createId(),
      ticketId,
      actorId,
      actorName,
      actorRole,
      action: statusRow.isClosedState ? "ticket_closed" : "status_changed",
      metadata: { from: previousStatus, to: newStatus },
      createdAt: now,
    });
    changed = true;
  }

  // Category change
  if (body.category !== undefined && body.category !== ticket.category) {
    const validCategories = await getTicketCategories();
    if (!validCategories.some((c) => c.slug === body.category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    const previousCategory = ticket.category;
    const newCategory = body.category;

    await db
      .update(tickets)
      .set({ category: newCategory, updatedAt: now })
      .where(eq(tickets.id, ticketId));

    await db.insert(ticketActivity).values({
      id: createId(),
      ticketId,
      actorId,
      actorName,
      actorRole,
      action: "category_changed",
      metadata: { from: previousCategory, to: newCategory },
      createdAt: now,
    });
    changed = true;
  }

  // Priority change
  if (body.priority !== undefined && body.priority !== ticket.priority) {
    const validPriorities = await getTicketPriorities();
    if (!validPriorities.some((p) => p.slug === body.priority)) {
      return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
    }
    const previousPriority = ticket.priority;
    const newPriority = body.priority;

    await db
      .update(tickets)
      .set({ priority: newPriority, updatedAt: now })
      .where(eq(tickets.id, ticketId));

    await db.insert(ticketActivity).values({
      id: createId(),
      ticketId,
      actorId,
      actorName,
      actorRole,
      action: "priority_changed",
      metadata: { from: previousPriority, to: newPriority },
      createdAt: now,
    });
    changed = true;
  }

  // Assignment change
  if ("assignedAgentId" in body) {
    const newAgentId = body.assignedAgentId ?? null;
    if (newAgentId !== ticket.assignedAgentId) {
      await db
        .update(tickets)
        .set({ assignedAgentId: newAgentId, updatedAt: now })
        .where(eq(tickets.id, ticketId));

      await db.insert(ticketActivity).values({
        id: createId(),
        ticketId,
        actorId,
        actorName,
        actorRole,
        action: newAgentId ? "assigned" : "unassigned",
        metadata: newAgentId ? { agentId: newAgentId } : null,
        createdAt: now,
      });
      changed = true;
    }
  }

  return NextResponse.json({ ok: true, changed });
}

// DELETE /api/tickets/[id] — hard delete ticket + storage cleanup (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user || session.user.role !== ADMIN_ROLE) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: ticketId } = await params;

  const [ticket] = await db
    .select({ id: tickets.id, ticketNumber: tickets.ticketNumber })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Delete storage files before DB records
  const attachments = await db
    .select({ storageKey: ticketAttachments.storageKey })
    .from(ticketAttachments)
    .where(eq(ticketAttachments.ticketId, ticketId));

  for (const att of attachments) {
    try {
      await storage.delete(att.storageKey);
    } catch {
      // Non-fatal — proceed even if storage delete fails
    }
  }

  // Delete ticket (cascade removes comments, activity, attachments)
  await db.delete(tickets).where(eq(tickets.id, ticketId));

  return NextResponse.json({ ok: true });
}
