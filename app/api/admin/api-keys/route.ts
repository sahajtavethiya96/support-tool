import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { audit } from "@/lib/audit";
import { requireAdminFromRequest } from "@/lib/authz";

// GET /api/admin/api-keys — list keys (never returns the raw secret)
export async function GET(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const keys = await listApiKeys();
  return NextResponse.json(
    keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      createdByName: k.createdByName,
      portalUrlTemplate: k.portalUrlTemplate,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
    }))
  );
}

// POST /api/admin/api-keys — create a key. The raw secret is returned once,
// in this response only — never retrievable again.
export async function POST(request: NextRequest) {
  let admin: { id: string; name: string; email: string };
  try {
    admin = requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  let body: { name?: string; portalUrlTemplate?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const name = body.name?.trim();
  if (!name || name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { error: "Name must be 2–100 characters." },
      { status: 400 }
    );
  }

  const { record, rawKey } = await createApiKey({
    name,
    createdById: admin.id,
    createdByName: admin.name,
    portalUrlTemplate: body.portalUrlTemplate?.trim() || null,
  });

  await audit({
    action: "api_key.created",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Created API key "${name}"`,
    entityId: record.id,
    entityType: "api_key",
    metadata: { name, keyPrefix: record.keyPrefix },
  });

  return NextResponse.json(
    {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      portalUrlTemplate: record.portalUrlTemplate,
      createdAt: record.createdAt,
      rawKey,
    },
    { status: 201 }
  );
}
