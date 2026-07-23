import { createId } from "@paralleldrive/cuid2";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ticketStatuses } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdminFromRequest } from "@/lib/authz";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// GET — agent/admin can read (middleware already enforced access)
export async function GET(_request: NextRequest) {
  const statuses = await db
    .select()
    .from(ticketStatuses)
    .orderBy(asc(ticketStatuses.sortOrder));

  return NextResponse.json(statuses);
}

// POST — admin only
export async function POST(request: NextRequest) {
  let admin;
  try { admin = requireAdminFromRequest(request); } catch (e) { return e as Response; }

  let body: { label?: string; color?: string; isDefault?: boolean; isClosedState?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const label = body.label?.trim();
  if (!label) return NextResponse.json({ error: "Label is required." }, { status: 400 });

  const slug = slugify(label);
  if (!slug) return NextResponse.json({ error: "Could not generate a valid slug." }, { status: 400 });

  const color = body.color ?? "blue";
  const isDefault = body.isDefault ?? false;
  const isClosedState = body.isClosedState ?? false;

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: ticketStatuses.id })
    .from(ticketStatuses)
    .where(eq(ticketStatuses.slug, slug))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "A status with this slug already exists." }, { status: 400 });
  }

  const now = new Date();

  // If setting as default, unset current default first
  if (isDefault) {
    await db
      .update(ticketStatuses)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(ticketStatuses.isDefault, true));
  }

  // Get next sortOrder
  const all = await db.select({ sortOrder: ticketStatuses.sortOrder }).from(ticketStatuses);
  const nextSort = all.length > 0 ? Math.max(...all.map((r) => r.sortOrder)) + 1 : 0;

  const [inserted] = await db
    .insert(ticketStatuses)
    .values({
      id: createId(),
      slug,
      label,
      color,
      sortOrder: nextSort,
      isDefault,
      isClosedState,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await audit({
    action: "ticket_config.status_created",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Created status "${label}"`,
    entityId: inserted.id,
    entityType: "ticket_status",
    metadata: { slug, label, color, isDefault, isClosedState },
  });

  return NextResponse.json(inserted, { status: 201 });
}
