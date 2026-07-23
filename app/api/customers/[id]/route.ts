import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAgentFromRequest } from "@/lib/authz";
import { getCustomerProfile, updateCustomerNote } from "@/lib/customers";

// GET /api/customers/[id] — agent/admin only. Returns the customer profile
// popover's data: identity, note, open/closed ticket lists, and a 12-month
// ticket-frequency series.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAgentFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;
  const profile = await getCustomerProfile(id);
  if (!profile) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(profile);
}

// PATCH /api/customers/[id] — agent/admin only. Updates the customer's note.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAgentFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const { id } = await params;

  let body: { note?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (typeof body.note !== "string") {
    return NextResponse.json(
      { error: "Field 'note' is required." },
      { status: 400 }
    );
  }

  const updated = await updateCustomerNote(id, body.note);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
