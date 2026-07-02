import { createId } from "@paralleldrive/cuid2";
import { and, eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import { ticketActivity, ticketAttachments, tickets, user } from "@/db/schema";
import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email";
import { ticketCreatedTemplate } from "@/lib/email/templates/ticket-created";
import { env } from "@/lib/env";
import { createNotifications } from "@/lib/notifications";
import { publishPushToUsers } from "@/lib/push";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { storage } from "@/lib/storage";
import {
  getDefaultPriority,
  getDefaultStatus,
  getTicketCategories,
} from "@/lib/ticket-config";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/zip",
  "text/plain",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

// POST /api/tickets — public (customer ticket submission)
export async function POST(request: NextRequest) {
  const { allowed } = await checkRateLimit({
    action: "ticket_submit",
    key: getClientIp(request),
    limit: 5,
    windowMinutes: 10,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const attachmentFiles = formData
    .getAll("attachments")
    .filter((v): v is File => v instanceof File && v.size > 0);

  // Validation
  if (!name || name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { error: "Name must be 2–100 characters." },
      { status: 400 }
    );
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400 }
    );
  }
  if (!subject || subject.length < 5 || subject.length > 200) {
    return NextResponse.json(
      { error: "Subject must be 5–200 characters." },
      { status: 400 }
    );
  }
  if (!description || description.length < 10 || description.length > 5000) {
    return NextResponse.json(
      { error: "Description must be 10–5000 characters." },
      { status: 400 }
    );
  }
  const [validCategories, defaultStatus, defaultPriority] = await Promise.all([
    getTicketCategories(),
    getDefaultStatus(),
    getDefaultPriority(),
  ]);
  if (!validCategories.some((c) => c.slug === category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  if (attachmentFiles.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files allowed.` },
      { status: 400 }
    );
  }
  for (const file of attachmentFiles) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds the 10 MB limit.` },
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

  const ticketId = createId();
  const customerToken = createId();
  const now = new Date();

  // Upload attachments first (so we can roll back cleanly if DB fails)
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
    const [inserted] = await db
      .insert(tickets)
      .values({
        id: ticketId,
        subject,
        description,
        category,
        status: defaultStatus?.slug ?? "open",
        priority: defaultPriority?.slug ?? "normal",
        customerName: name,
        customerEmail: email,
        customerToken,
        // A brand-new ticket is awaiting the team's first reply.
        awaitingReply: true,
        pendingReplies: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ ticketNumber: tickets.ticketNumber });

    // Insert attachments
    if (uploadedAttachments.length > 0) {
      await db.insert(ticketAttachments).values(
        uploadedAttachments.map((a) => ({
          id: a.id,
          ticketId,
          filename: a.filename,
          storageKey: a.storageKey,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          uploadedByName: name,
          uploadedByRole: "customer",
          createdAt: now,
        }))
      );
    }

    // Log activity
    await db.insert(ticketActivity).values({
      id: createId(),
      ticketId,
      actorName: name,
      actorRole: "customer",
      action: "ticket_created",
      createdAt: now,
    });

    // Enqueue ticket.created email (non-blocking)
    const ticketUrl = `${env.NEXT_PUBLIC_APP_URL}/ticket/${ticketId}?token=${customerToken}`;
    const myTicketsUrl = `${env.NEXT_PUBLIC_APP_URL}/my-tickets`;
    ticketCreatedTemplate({
      customerName: name,
      ticketNumber: inserted.ticketNumber,
      ticketSubject: subject,
      ticketUrl,
      myTicketsUrl,
    })
      .then(({ html, text }) =>
        enqueueEmail({
          to: email,
          subject: `[#${inserted.ticketNumber}] Your ticket has been received — ${subject}`,
          html,
          text,
        })
      )
      .catch((err) => console.error("[ticket.created email]", err));

    // Notify agents in-app + push — a brand-new ticket has no assigned
    // agent yet, so every active agent/admin gets pinged.
    const agents = await db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          or(eq(user.role, AGENT_ROLE), eq(user.role, ADMIN_ROLE)),
          eq(user.banned, false)
        )
      );
    const recipientIds = agents.map((a) => a.id);
    const notifTitle = `New ticket #${inserted.ticketNumber} from ${name}`;

    await createNotifications(recipientIds, {
      type: "ticket_created",
      title: notifTitle,
      body: subject,
      ticketId,
      ticketNumber: inserted.ticketNumber,
    }).catch((err) => console.error("[notification.ticket_created]", err));

    await publishPushToUsers(recipientIds, {
      title: notifTitle,
      body: subject,
      deepLink: `${env.NEXT_PUBLIC_APP_URL}/tickets/${ticketId}`,
    }).catch((err) => console.error("[push.ticket_created]", err));

    return NextResponse.json(
      { ticketNumber: inserted.ticketNumber },
      { status: 201 }
    );
  } catch (err) {
    // Clean up uploaded files on DB failure
    for (const a of uploadedAttachments) {
      await storage.delete(a.storageKey).catch(() => undefined);
    }
    console.error("[POST /api/tickets]", err);
    return NextResponse.json(
      { error: "Failed to create ticket." },
      { status: 500 }
    );
  }
}
