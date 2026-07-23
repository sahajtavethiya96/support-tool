import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/authz";
import { env } from "@/lib/env";
import { buildWebhooksOpenApiSpec } from "@/lib/webhooks-openapi-spec";

// GET /api/admin/webhooks/openapi — downloads the OpenAPI 3.1 spec for
// OUTBOUND webhooks, pre-filled with this instance's own base URL. The
// Scalar reference at /admin/webhooks/docs renders it; most API tooling that
// understands OpenAPI 3.1's `webhooks` keyword accepts it directly. No
// secrets in the file — signing secrets are never included.
export async function GET(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  return NextResponse.json(buildWebhooksOpenApiSpec(env.NEXT_PUBLIC_APP_URL), {
    headers: {
      "Content-Disposition":
        'attachment; filename="support-tool-webhooks.openapi.json"',
    },
  });
}
