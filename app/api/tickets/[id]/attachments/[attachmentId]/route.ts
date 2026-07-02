import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ticketActivity, ticketAttachments } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// DELETE /api/tickets/[id]/attachments/[attachmentId] — agent/admin only.
// Per docs/file-uploads.md: delete the storage file first (log-and-proceed on
// failure — an orphaned storage file is acceptable, an unrecoverable
// attachment reference is worse), then delete the DB row.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (
    !session?.user ||
    (session.user.role !== "agent" && session.user.role !== "admin")
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id: ticketId, attachmentId } = await params;

  const [attachment] = await db
    .select()
    .from(ticketAttachments)
    .where(
      and(
        eq(ticketAttachments.id, attachmentId),
        eq(ticketAttachments.ticketId, ticketId)
      )
    )
    .limit(1);
  if (!attachment) {
    return NextResponse.json(
      { error: "Attachment not found." },
      { status: 404 }
    );
  }

  try {
    await storage.delete(attachment.storageKey);
  } catch (err) {
    console.error("[attachment delete] storage cleanup failed", err);
    // proceed anyway — per docs/file-uploads.md
  }

  await db
    .delete(ticketAttachments)
    .where(eq(ticketAttachments.id, attachmentId));

  await db.insert(ticketActivity).values({
    id: createId(),
    ticketId,
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email,
    actorRole: session.user.role,
    action: "attachment_deleted",
    metadata: { filename: attachment.filename },
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
