import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api-keys";
import { requireAdminFromRequest } from "@/lib/authz";

// DELETE /api/admin/api-keys/:id — soft revoke (sets revokedAt, keeps the row)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdminFromRequest(request);
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

  return NextResponse.json({ ok: true });
}
