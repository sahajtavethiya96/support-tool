import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ticketCustomFields } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdminFromRequest } from "@/lib/authz";
import { CUSTOM_FIELD_TYPES, getCustomFields } from "@/lib/custom-fields";
import { db } from "@/lib/db";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// GET — agent/admin can read (middleware already enforced access) — the
// agent ticket detail page and ticket-creation validation both need field
// definitions, not just the admin manager.
export async function GET(_request: NextRequest) {
  const fields = await getCustomFields();
  return NextResponse.json(fields);
}

// POST — admin only
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  let body: {
    label?: string;
    type?: string;
    required?: boolean;
    options?: unknown;
  } = {};
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

  const type = body.type;
  if (!type || !CUSTOM_FIELD_TYPES.includes(type as (typeof CUSTOM_FIELD_TYPES)[number])) {
    return NextResponse.json(
      { error: `Type must be one of: ${CUSTOM_FIELD_TYPES.join(", ")}.` },
      { status: 400 }
    );
  }

  let options: string[] | null = null;
  if (type === "select") {
    const raw = Array.isArray(body.options) ? body.options : [];
    options = Array.from(
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
  }

  const key = slugify(label);
  if (!key) {
    return NextResponse.json(
      { error: "Could not generate a valid key from this label." },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select({ id: ticketCustomFields.id })
    .from(ticketCustomFields)
    .where(eq(ticketCustomFields.key, key))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "A custom field with this label already exists." },
      { status: 400 }
    );
  }

  const now = new Date();
  const all = await db
    .select({ sortOrder: ticketCustomFields.sortOrder })
    .from(ticketCustomFields);
  const nextSort = all.length > 0 ? Math.max(...all.map((r) => r.sortOrder)) + 1 : 0;

  const [inserted] = await db
    .insert(ticketCustomFields)
    .values({
      id: createId(),
      key,
      label,
      type,
      options,
      required: body.required ?? false,
      sortOrder: nextSort,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await audit({
    action: "custom_field.created",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Created custom field "${label}"`,
    entityId: inserted.id,
    entityType: "custom_field",
    metadata: { key, label, type, required: body.required ?? false },
  });

  return NextResponse.json(inserted, { status: 201 });
}
