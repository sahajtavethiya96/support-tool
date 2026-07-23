import { createId } from "@paralleldrive/cuid2";
import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { customers, tickets } from "@/db/schema";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { htmlToRichTextJson, textToRichTextJson } from "@/lib/rich-text";
import {
  API_MAX_ATTACHMENTS_PER_TICKET,
  decodeBase64Attachments,
  uploadDecodedAttachments,
} from "@/lib/tickets/api-attachments";
import {
  createTicketFromSubmission,
  validateTicketSubmission,
} from "@/lib/tickets/create-ticket";

const LIST_LIMIT = 50;

// GET /api/v1/tickets?email=customer@example.com — public API, authenticated
// with an API key. Lists that customer's tickets, most recent first. Any
// active key can list any customer's tickets — same single-tenant reasoning
// as GET /api/v1/tickets/:id (no per-key scoping on this deployment).
export async function GET(request: NextRequest) {
  try {
    await requireApiKey(request);
  } catch (e) {
    return e as Response;
  }

  const email = request.nextUrl.searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "Query parameter 'email' is required." },
      { status: 400 }
    );
  }

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, email.toLowerCase()))
    .limit(1);

  const rows = customer
    ? await db
        .select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          subject: tickets.subject,
          status: tickets.status,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
        })
        .from(tickets)
        .where(eq(tickets.customerId, customer.id))
        .orderBy(desc(tickets.createdAt))
        .limit(LIST_LIMIT)
    : [];

  return NextResponse.json({ tickets: rows });
}

// POST /api/v1/tickets — public API, authenticated with an API key
// (Authorization: Bearer stk_live_...). See docs/api.md for the full
// reference. JSON only — attachments aren't supported via the API yet.
export async function POST(request: NextRequest) {
  let apiKey: { id: string; name: string };
  try {
    apiKey = await requireApiKey(request);
  } catch (e) {
    return e as Response;
  }

  const { allowed } = await checkRateLimit({
    action: "api_ticket_create",
    key: apiKey.id,
    limit: 100,
    windowMinutes: 1,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: {
    name?: string;
    email?: string;
    subject?: string;
    description?: string;
    descriptionFormat?: string;
    category?: string;
    priority?: string;
    attachments?: unknown;
    customFields?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // "text" (default) or "html" — either way, converted to the same Tiptap
  // JSON document the app's own editor produces, before validation ever
  // sees it. HTML is parsed strictly through our schema (htmlToRichTextJson),
  // so unrecognized tags/attributes are dropped, never stored as-is.
  const rawDescription = String(body.description ?? "");
  const description =
    body.descriptionFormat === "html"
      ? htmlToRichTextJson(rawDescription)
      : textToRichTextJson(rawDescription);

  // A brand-new ticket has no attachments yet, so the full per-ticket cap is
  // available. Decode/validate the files here, but only after the ticket
  // fields themselves validate — files should never be uploaded for a
  // submission that's going to be rejected anyway.
  const decoded = decodeBase64Attachments(
    body.attachments,
    API_MAX_ATTACHMENTS_PER_TICKET
  );
  if (!decoded.ok) {
    return NextResponse.json({ error: decoded.error }, { status: 400 });
  }

  const validated = await validateTicketSubmission({
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    subject: String(body.subject ?? ""),
    description,
    category: String(body.category ?? ""),
    priority: body.priority ? String(body.priority) : undefined,
    customFields: body.customFields,
  });
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error },
      { status: validated.httpStatus }
    );
  }

  const ticketId = createId();
  let uploadedAttachments: Awaited<ReturnType<typeof uploadDecodedAttachments>>;
  try {
    uploadedAttachments = await uploadDecodedAttachments(
      ticketId,
      decoded.attachments
    );
  } catch (err) {
    console.error("[POST /api/v1/tickets] attachment upload", err);
    return NextResponse.json(
      { error: "Failed to store attachments." },
      { status: 500 }
    );
  }

  const result = await createTicketFromSubmission({
    id: ticketId,
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    subject: String(body.subject ?? ""),
    description,
    category: String(body.category ?? ""),
    priority: body.priority ? String(body.priority) : undefined,
    customFields: body.customFields,
    source: "api",
    apiKeyId: apiKey.id,
    apiKeyName: apiKey.name,
    attachments: uploadedAttachments,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(
    {
      id: result.id,
      ticketNumber: result.ticketNumber,
      status: result.status,
      portalUrl: result.portalUrl,
    },
    { status: 201 }
  );
}
