import { createId } from "@paralleldrive/cuid2";
import { and, count, eq, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import {
  ticketActivity,
  ticketAttachments,
  ticketComments,
  tickets,
  user,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email";
import { ticketRepliedTemplate } from "@/lib/email/templates/ticket-replied";
import { env } from "@/lib/env";
import { createNotifications } from "@/lib/notifications";
import { publishPushToUsers } from "@/lib/push";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { publishTicketCommentCreated } from "@/lib/realtime";
import { isRichTextEmpty, richTextToPlainText } from "@/lib/rich-text";
import { storage } from "@/lib/storage";
import { isClosedStatusSlug } from "@/lib/ticket-config";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/zip",
  "text/plain",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_TICKET = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const content = String(formData.get("content") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const attachmentFiles = formData
    .getAll("attachments")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (!content || isRichTextEmpty(content)) {
    return NextResponse.json(
      { error: "Content is required." },
      { status: 400 }
    );
  }

  // Plain-text form of the (Tiptap JSON) reply, for email/notification/push previews.
  const contentText = richTextToPlainText(content);

  // Determine actor: customer (token) or agent (session)
  let authorName: string;
  let authorRole: "customer" | "agent" | "admin";
  let authorId: string | undefined;
  let isInternal = false;
  let ticketData:
    | {
        customerName: string;
        customerEmail: string;
        customerToken: string;
        ticketNumber: number;
        subject: string;
        assignedAgentId: string | null;
      }
    | undefined;

  // The two reply forms are mutually exclusive by construction: only the
  // customer form ever sends `token`, only the agent form relies on a
  // session. Check `token` FIRST and treat it as authoritative — otherwise a
  // customer submitting from a browser that also happens to carry a valid
  // agent session cookie (e.g. an agent testing their own portal in another
  // tab of the same browser profile) would have their reply silently
  // misattributed to that agent, since the session would otherwise win.
  if (token) {
    const { allowed } = await checkRateLimit({
      action: "ticket_comment",
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

    const [ticket] = await db
      .select({
        status: tickets.status,
        customerName: tickets.customerName,
        customerEmail: tickets.customerEmail,
        customerToken: tickets.customerToken,
        ticketNumber: tickets.ticketNumber,
        subject: tickets.subject,
        assignedAgentId: tickets.assignedAgentId,
      })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.customerToken, token)))
      .limit(1);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
    if (await isClosedStatusSlug(ticket.status)) {
      return NextResponse.json(
        { error: "Cannot reply to a closed ticket." },
        { status: 400 }
      );
    }
    authorName = ticket.customerName;
    authorRole = "customer";
    ticketData = ticket;
  } else {
    const session = await auth.api.getSession({ headers: request.headers });

    if (
      !(
        session?.user &&
        (session.user.role === "agent" || session.user.role === "admin")
      )
    ) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Agent/admin comment
    authorId = session.user.id;
    authorName = session.user.name ?? session.user.email;
    authorRole = session.user.role as "agent" | "admin";
    isInternal = formData.get("isInternal") === "true";

    const [ticket] = await db
      .select({
        status: tickets.status,
        customerName: tickets.customerName,
        customerEmail: tickets.customerEmail,
        customerToken: tickets.customerToken,
        ticketNumber: tickets.ticketNumber,
        subject: tickets.subject,
        assignedAgentId: tickets.assignedAgentId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
    if (await isClosedStatusSlug(ticket.status)) {
      return NextResponse.json(
        { error: "Cannot comment on a closed ticket." },
        { status: 400 }
      );
    }
    ticketData = ticket;
  }

  // Check attachment count
  if (attachmentFiles.length > 0) {
    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, ticketId));

    const remaining = MAX_ATTACHMENTS_PER_TICKET - existingCount;
    if (attachmentFiles.length > remaining) {
      return NextResponse.json(
        {
          error: `Only ${remaining} more attachment(s) allowed on this ticket.`,
        },
        { status: 400 }
      );
    }
    for (const file of attachmentFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `"${file.name}" exceeds the 10 MB limit.` },
          { status: 400 }
        );
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `File type "${file.type}" is not allowed.` },
          { status: 400 }
        );
      }
    }
  }

  const commentId = createId();
  const now = new Date();

  // Upload files before DB writes
  const uploadedAttachments: Array<{
    id: string;
    filename: string;
    storageKey: string;
    fileSize: number;
    mimeType: string;
  }> = [];

  for (const file of attachmentFiles) {
    const ext = file.name.split(".").pop() ?? "bin";
    const storageKey = `tickets/${ticketId}/${createId()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.upload(storageKey, buffer, file.type);
    uploadedAttachments.push({
      id: createId(),
      filename: file.name,
      storageKey,
      fileSize: file.size,
      mimeType: file.type,
    });
  }

  try {
    await db.insert(ticketComments).values({
      id: commentId,
      ticketId,
      authorId: authorId ?? null,
      authorName,
      authorRole,
      content,
      isInternal,
      createdAt: now,
      updatedAt: now,
    });

    if (uploadedAttachments.length > 0) {
      await db.insert(ticketAttachments).values(
        uploadedAttachments.map((a) => ({
          id: a.id,
          ticketId,
          commentId,
          filename: a.filename,
          storageKey: a.storageKey,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          uploadedById: authorId ?? null,
          uploadedByName: authorName,
          uploadedByRole: authorRole,
          createdAt: now,
        }))
      );
    }

    // Maintain the "awaiting reply" flag + unread count. Internal notes don't
    // change it (they're not customer-facing conversation).
    const awaitingUpdate = isInternal
      ? {}
      : authorRole === "customer"
        ? {
            awaitingReply: true,
            pendingReplies: sql`${tickets.pendingReplies} + 1`,
          }
        : { awaitingReply: false, pendingReplies: 0 };

    await db
      .update(tickets)
      .set({ updatedAt: now, ...awaitingUpdate })
      .where(eq(tickets.id, ticketId));

    await db.insert(ticketActivity).values({
      id: createId(),
      ticketId,
      actorId: authorId ?? null,
      actorName: authorName,
      actorRole: authorRole,
      action: isInternal ? "internal_note_added" : "comment_added",
      createdAt: now,
    });

    // Live-refresh anyone currently viewing this ticket — any comment
    // (reply or internal note, from any author), not just customer replies.
    // No-op unless Pusher Channels is configured.
    await publishTicketCommentCreated(ticketId).catch((err) =>
      console.error("[realtime.comment_created]", err)
    );

    // Notify customer when an agent posts a public reply
    if (!isInternal && authorRole !== "customer" && ticketData) {
      const ticketUrl = `${env.NEXT_PUBLIC_APP_URL}/ticket/${ticketId}?token=${ticketData.customerToken}`;
      ticketRepliedTemplate({
        customerName: ticketData.customerName,
        ticketNumber: ticketData.ticketNumber,
        ticketSubject: ticketData.subject,
        replyContent: contentText,
        ticketUrl,
        agentName: authorName,
      })
        .then(({ html, text }) =>
          enqueueEmail({
            to: ticketData!.customerEmail,
            subject: `[#${ticketData!.ticketNumber}] New reply on your ticket — ${ticketData!.subject}`,
            html,
            text,
          })
        )
        .catch((err) => console.error("[ticket.replied email]", err));
    }

    // Notify agents in-app when a customer posts a reply.
    // Assigned ticket → the assigned agent; otherwise every active agent/admin.
    if (authorRole === "customer" && ticketData) {
      let recipientIds: string[] = [];

      if (ticketData.assignedAgentId) {
        const [agent] = await db
          .select({ id: user.id })
          .from(user)
          .where(
            and(eq(user.id, ticketData.assignedAgentId), eq(user.banned, false))
          )
          .limit(1);
        if (agent) {
          recipientIds = [agent.id];
        }
      } else {
        const agents = await db
          .select({ id: user.id })
          .from(user)
          .where(
            and(
              or(eq(user.role, AGENT_ROLE), eq(user.role, ADMIN_ROLE)),
              eq(user.banned, false)
            )
          );
        recipientIds = agents.map((a) => a.id);
      }

      const notifTitle = `${ticketData.customerName} replied to #${ticketData.ticketNumber}`;

      await createNotifications(recipientIds, {
        type: "customer_replied",
        title: notifTitle,
        body: contentText.slice(0, 200),
        ticketId,
        ticketNumber: ticketData.ticketNumber,
      }).catch((err) => console.error("[notification.customer_replied]", err));

      // OS-level push (no-op unless Pusher Beams is configured).
      await publishPushToUsers(recipientIds, {
        title: notifTitle,
        body: contentText.slice(0, 120),
        deepLink: `${env.NEXT_PUBLIC_APP_URL}/tickets/${ticketId}`,
      }).catch((err) => console.error("[push.customer_replied]", err));
    }

    return NextResponse.json({ id: commentId }, { status: 201 });
  } catch (err) {
    for (const a of uploadedAttachments) {
      await storage.delete(a.storageKey).catch(() => undefined);
    }
    console.error("[POST /api/tickets/[id]/comments]", err);
    return NextResponse.json(
      { error: "Failed to add comment." },
      { status: 500 }
    );
  }
}
