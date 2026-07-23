import { createId } from "@paralleldrive/cuid2";
import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ticketPriorities } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdminFromRequest } from "@/lib/authz";
import { db } from "@/lib/db";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// GET — agent/admin can read (middleware already enforced access)
export async function GET(_request: NextRequest) {
  const priorities = await db
    .select()
    .from(ticketPriorities)
    .orderBy(asc(ticketPriorities.sortOrder));

  return NextResponse.json(priorities);
}

// POST — admin only
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  let body: { label?: string; color?: string; isDefault?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const label = body.label?.trim();
  if (!label) {
    return NextResponse.json({ error: "Label is required." }, { status: 400 });
  }

  const slug = slugify(label);
  if (!slug) {
    return NextResponse.json(
      { error: "Could not generate a valid slug." },
      { status: 400 }
    );
  }

  const color = body.color ?? "slate";
  const isDefault = body.isDefault ?? false;

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: ticketPriorities.id })
    .from(ticketPriorities)
    .where(eq(ticketPriorities.slug, slug))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "A priority with this slug already exists." },
      { status: 400 }
    );
  }

  const now = new Date();

  // If setting as default, unset current default first
  if (isDefault) {
    await db
      .update(ticketPriorities)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(ticketPriorities.isDefault, true));
  }

  // Get next sortOrder
  const all = await db
    .select({ sortOrder: ticketPriorities.sortOrder })
    .from(ticketPriorities);
  const nextSort =
    all.length > 0 ? Math.max(...all.map((r) => r.sortOrder)) + 1 : 0;

  const [inserted] = await db
    .insert(ticketPriorities)
    .values({
      id: createId(),
      slug,
      label,
      color,
      sortOrder: nextSort,
      isDefault,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await audit({
    action: "ticket_config.priority_created",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Created priority "${label}"`,
    entityId: inserted.id,
    entityType: "ticket_priority",
    metadata: { slug, label, color, isDefault },
  });

  return NextResponse.json(inserted, { status: 201 });
}
