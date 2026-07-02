import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_ROLE, AGENT_ROLE } from "@/config/platform";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (!session || !session.user) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { id, name, email, role, banned } = session.user;

  if (banned) {
    if (isApi) {
      return NextResponse.json({ error: "Account banned" }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const userRole = (role as string) ?? "";
  const isAgent = userRole === AGENT_ROLE || userRole === ADMIN_ROLE;
  const isAdmin = userRole === ADMIN_ROLE;

  // Admin-only routes
  if (
    (request.nextUrl.pathname.startsWith("/admin") ||
      request.nextUrl.pathname.startsWith("/api/admin")) &&
    !isAdmin
  ) {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/tickets", request.url));
  }

  // Agent+admin routes
  if (!isAgent) {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Inject user info and pathname into request headers for layouts and API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", id);
  requestHeaders.set("x-user-name", name ?? "");
  requestHeaders.set("x-user-email", email);
  requestHeaders.set("x-user-role", userRole);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tickets/:path*",
    "/admin/:path*",
    "/canned-responses/:path*",
    "/api/admin/:path*",
    "/api/stats/:path*",
    "/api/agents/:path*",
    "/api/users/:path*",
    "/api/account/:path*",
    "/api/notifications/:path*",
    "/api/canned-responses/:path*",
  ],
};
