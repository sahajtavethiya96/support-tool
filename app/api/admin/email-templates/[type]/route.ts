import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  EMAIL_TEMPLATE_TYPES,
  type EmailTemplateType,
  setEmailTemplate,
} from "@/lib/email-templates";
import { audit } from "@/lib/audit";
import { requireAdminFromRequest } from "@/lib/authz";

function isValidType(type: string): type is EmailTemplateType {
  return EMAIL_TEMPLATE_TYPES.some((t) => t.type === type);
}

// PATCH — admin only. Body `{ subject?, body? }`, each `string | null`.
// `null` resets that field to the built-in default; omit a field to leave
// it untouched (same partial-update convention as every other settings
// PATCH route).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  let admin;
  try {
    admin = requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { type } = await params;
  if (!isValidType(type)) {
    return NextResponse.json(
      { error: "Unknown email template type." },
      { status: 404 }
    );
  }

  let body: { subject?: string | null; body?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const subject =
    body.subject === undefined
      ? undefined
      : (body.subject?.trim() ?? "") || null;
  const bodyField =
    body.body === undefined ? undefined : (body.body?.trim() ?? "") || null;

  const row = await setEmailTemplate(type, {
    subject,
    body: bodyField,
  });

  await audit({
    action: "email_template.updated",
    actorEmail: admin.email,
    actorId: admin.id,
    description: `Updated the "${type}" email template`,
    entityId: type,
    entityType: "email_template",
    metadata: {
      subjectReset: subject === null,
      bodyReset: bodyField === null,
    },
  });

  return NextResponse.json(row);
}
