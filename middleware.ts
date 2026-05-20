import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ["/signin", "/api/auth", "/api/local-upload", "/api/local-download"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (isPublic) {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session?.user) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const hallMatch = pathname.match(/^\/h\/([^/]+)/);
  if (hallMatch) {
    const hallSlug = hallMatch[1];
    const { role, hallSlug: userHallSlug } = session.user;

    if (role !== "SUPER_ADMIN" && userHallSlug !== hallSlug) {
      if (userHallSlug) {
        return NextResponse.redirect(new URL(`/h/${userHallSlug}`, request.url));
      }
      return NextResponse.redirect(new URL("/signin", request.url));
    }
  }

  if (pathname.startsWith("/admin") && session.user.role !== "SUPER_ADMIN") {
    if (session.user.hallSlug) {
      return NextResponse.redirect(
        new URL(`/h/${session.user.hallSlug}`, request.url),
      );
    }
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
