import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ticketCustomFields } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdminFromRequest } from "@/lib/authz";
import { db } from "@/lib/db";

// PATCH — admin only. Type and key are immutable after creation (changing
// type could strand already-stored values in an incompatible format).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;

  let body: { label?: string; required?: boolean; options?: unknown } = {};
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
    .from(ticketCustomFields)
    .where(eq(ticketCustomFields.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const now = new Date();
  const updateData: Partial<typeof ticketCustomFields.$inferInsert> & {
    updatedAt: Date;
  } = { updatedAt: now };

  if (body.label !== undefined) {
    const label = body.label.trim();
    if (!label) {
      return NextResponse.json({ error: "Label is required." }, { status: 400 });
    }
    updateData.label = label;
  }
  if (body.required !== undefined) {
    updateData.required = Boolean(body.required);
  }
  if (body.options !== undefined) {
    if (existing.type !== "select") {
      return NextResponse.json(
        { error: "Only select fields have options." },
        { status: 400 }
      );
    }
    const raw = Array.isArray(body.options) ? body.options : [];
    const options = Array.from(
      new Set(
        raw
          .map((o) => (typeof o === "string" ? o.trim() : ""))
          .filter((o) => o.length > 0)
      )
    );
    if (options.length < 2) {
      return NextResponse.json(
        { error: "A select field needs at least 2 options." },
        { status: 400 }
      );
    }
    updateData.options = options;
  }

  const [updated] = await db
    .update(ticketCustomFields)
    .set(updateData)
    .where(eq(ticketCustomFields.id, id))
    .returning();

  await audit({
    action: "custom_field.updated",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Updated custom field "${existing.label}"`,
    entityId: id,
    entityType: "custom_field",
    metadata: { key: existing.key, changes: body },
  });

  return NextResponse.json(updated);
}

// DELETE — admin only. Cascades to ticket_custom_field_values (hard delete,
// no "blocked because in use" check — unlike categories/statuses this is a
// real FK relationship, not a denormalized slug string on tickets).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;

  const [existing] = await db
    .select({ id: ticketCustomFields.id, key: ticketCustomFields.key, label: ticketCustomFields.label })
    .from(ticketCustomFields)
    .where(eq(ticketCustomFields.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.delete(ticketCustomFields).where(eq(ticketCustomFields.id, id));

  await audit({
    action: "custom_field.deleted",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Deleted custom field "${existing.label}"`,
    entityId: id,
    entityType: "custom_field",
    metadata: { key: existing.key, label: existing.label },
  });

  return NextResponse.json({ ok: true });
}
