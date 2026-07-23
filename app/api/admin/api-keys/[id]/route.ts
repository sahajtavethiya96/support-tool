import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revokeApiKey, updateApiKey } from "@/lib/api-keys";
import { audit } from "@/lib/audit";
import { requireAdminFromRequest } from "@/lib/authz";

// PATCH /api/admin/api-keys/:id — admin only. Partial update: only fields
// present in the body are changed. `portalUrlTemplate: null` (or "") clears
// the override, reverting to Support Tool's own customer portal links.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;

  let body: { name?: string; portalUrlTemplate?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const updates: { name?: string; portalUrlTemplate?: string | null } = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 2–100 characters." },
        { status: 400 }
      );
    }
    updates.name = name;
  }
  if (body.portalUrlTemplate !== undefined) {
    updates.portalUrlTemplate = body.portalUrlTemplate?.trim() || null;
  }

  const updated = await updateApiKey(id, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    keyPrefix: updated.keyPrefix,
    portalUrlTemplate: updated.portalUrlTemplate,
  });
}

// DELETE /api/admin/api-keys/:id — soft revoke (sets revokedAt, keeps the row)
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
  const revoked = await revokeApiKey(id);
  if (!revoked) {
    return NextResponse.json(
      { error: "Not found or already revoked." },
      { status: 404 }
    );
  }

  await audit({
    action: "api_key.revoked",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Revoked API key "${revoked.name}"`,
    entityId: id,
    entityType: "api_key",
    metadata: { name: revoked.name, keyPrefix: revoked.keyPrefix },
  });

  return NextResponse.json({ ok: true });
}
