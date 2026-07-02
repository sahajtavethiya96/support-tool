import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cannedResponses } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAgentFromRequest } from "@/lib/authz";
import { db } from "@/lib/db";
import { isRichTextEmpty } from "@/lib/rich-text";

// PATCH /api/canned-responses/[id] — agent/admin. Any agent can edit (team-shared).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAgentFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;

  let body: { title?: string; content?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(cannedResponses)
    .where(eq(cannedResponses.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updateData: Partial<typeof cannedResponses.$inferInsert> & {
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title || title.length < 2 || title.length > 100) {
      return NextResponse.json(
        { error: "Title must be 2–100 characters." },
        { status: 400 }
      );
    }
    updateData.title = title;
  }
  if (body.content !== undefined) {
    if (isRichTextEmpty(body.content)) {
      return NextResponse.json(
        { error: "Content is required." },
        { status: 400 }
      );
    }
    updateData.content = body.content;
  }

  const [updated] = await db
    .update(cannedResponses)
    .set(updateData)
    .where(eq(cannedResponses.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/canned-responses/[id] — agent/admin. Any agent can delete (team-shared).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let actor: ReturnType<typeof requireAgentFromRequest>;
  try {
    actor = requireAgentFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(cannedResponses)
    .where(eq(cannedResponses.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.delete(cannedResponses).where(eq(cannedResponses.id, id));

  await audit({
    action: "canned_response.deleted",
    actorId: actor.id,
    actorEmail: actor.email,
    description: `Deleted canned response "${existing.title}"`,
    entityType: "canned_response",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
