import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Note: this is middleware.ts, not proxy.ts — Next 16.2 has a bug where
// proxy.ts produces an empty middleware manifest in production builds
// (vercel/next.js#93328), silently disabling the auth guard.
export default auth((req) => {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/login", "/api"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
