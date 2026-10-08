import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth/token";
import { AREA_ROLES, HOME } from "@/lib/auth/rbac";

/**
 * Coarse gate on the Edge: signed-in? right area for the role? Real authorisation (fresh user + tenant state,
 * permission checks, RLS) happens server-side on every page/route, so this only avoids useless renders.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const area = Object.keys(AREA_ROLES).find((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!area) return NextResponse.next();

  const session = await verifySession(req.cookies.get(COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!AREA_ROLES[area].includes(session.role)) return NextResponse.redirect(new URL(HOME[session.role], req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/super-admin/:path*", "/admin/:path*", "/librarian/:path*", "/student/:path*"] };
