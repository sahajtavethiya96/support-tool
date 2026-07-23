import { createId } from "@paralleldrive/cuid2";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ticketCategories } from "@/db/schema";
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
  const categories = await db
    .select()
    .from(ticketCategories)
    .orderBy(asc(ticketCategories.sortOrder));

  return NextResponse.json(categories);
}

// POST — admin only
export async function POST(request: NextRequest) {
  let admin;
  try { admin = requireAdminFromRequest(request); } catch (e) { return e as Response; }

  let body: { label?: string; color?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const label = body.label?.trim();
  if (!label) return NextResponse.json({ error: "Label is required." }, { status: 400 });

  const slug = slugify(label);
  if (!slug) return NextResponse.json({ error: "Could not generate a valid slug." }, { status: 400 });

  const color = body.color ?? "slate";

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: ticketCategories.id })
    .from(ticketCategories)
    .where(eq(ticketCategories.slug, slug))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "A category with this slug already exists." }, { status: 400 });
  }

  const now = new Date();

  // Get next sortOrder
  const all = await db.select({ sortOrder: ticketCategories.sortOrder }).from(ticketCategories);
  const nextSort = all.length > 0 ? Math.max(...all.map((r) => r.sortOrder)) + 1 : 0;

  const [inserted] = await db
    .insert(ticketCategories)
    .values({
      id: createId(),
      slug,
      label,
      color,
      sortOrder: nextSort,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await audit({
    action: "ticket_config.category_created",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Created category "${label}"`,
    entityId: inserted.id,
    entityType: "ticket_category",
    metadata: { slug, label, color },
  });

  return NextResponse.json(inserted, { status: 201 });
}
