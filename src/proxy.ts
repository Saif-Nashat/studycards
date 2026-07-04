import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// (Next.js 16 renamed "middleware" to "proxy".) This runs before every page/API
// request and bounces anyone who isn't logged in to the login screen.

const COOKIE_NAME = "sc_session";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail closed in production: a missing secret must never silently fall
    // back to a publicly known value, or anyone could forge session tokens.
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
    return new TextEncoder().encode("dev-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

// Crawler/share assets must stay reachable without a session: robots and the
// sitemap for search engines, icon and opengraph-image for link previews.
const PUBLIC_PATHS = ["/login", "/api/login", "/robots.txt", "/sitemap.xml", "/icon", "/opengraph-image", "/favicon.ico"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  let valid = false;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
      // Sessions must belong to an account; pre-multiuser tokens (no uid)
      // get bounced to the login screen to sign in as a user.
      valid = typeof payload.uid === "string" && payload.uid.length > 0;
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
