import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTags } from "@/lib/tags";

// GET /api/tags?q=… — agent/admin only. Autocomplete search across the
// shared tag pool for the ticket-detail tag input.
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (
    !session?.user ||
    (session.user.role !== "agent" && session.user.role !== "admin")
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchTags(q);
  return NextResponse.json(results);
}
