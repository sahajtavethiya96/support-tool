import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { tickets } from "@/db/schema";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { createTicketFromSubmission } from "@/lib/tickets/create-ticket";

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

  const rows = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.customerEmail, email))
    .orderBy(desc(tickets.createdAt))
    .limit(LIST_LIMIT);

  return NextResponse.json({ tickets: rows });
}

// POST /api/v1/tickets — public API, authenticated with an API key
// (Authorization: Bearer sk_live_...). See docs/api.md for the full
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
    category?: string;
    priority?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await createTicketFromSubmission({
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    subject: String(body.subject ?? ""),
    description: String(body.description ?? ""),
    category: String(body.category ?? ""),
    priority: body.priority ? String(body.priority) : undefined,
    source: "api",
    apiKeyId: apiKey.id,
    apiKeyName: apiKey.name,
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
      portalUrl: `${env.NEXT_PUBLIC_APP_URL}/ticket/${result.id}?token=${result.customerToken}`,
    },
    { status: 201 }
  );
}
