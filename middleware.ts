import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route gate.
 *
 * Pages under the app shell check the session server-side anyway (see
 * app/(app)/layout.tsx), but doing it here means an unauthenticated request
 * never reaches a page render at all — no data queries, no layout work.
 *
 * The cookie value is only checked for *presence* here. It is never
 * trusted: every page and API route re-resolves the session against the
 * database and re-checks ownership. This middleware is a fast path, not the
 * security boundary.
 */
const SESSION_COOKIE = "smpl_session";
const LEGACY_SESSION_COOKIE = "declutter_session";

/** Paths that must stay reachable without a session. */
const PUBLIC_PREFIXES = [
  "/auth/",
  "/api/auth/",
  "/api/stripe/webhook",
  "/welcome",
  "/opengraph-image",
  "/twitter-image",
  "/_next/",
  "/favicon",
];

/** Public file extensions (static assets). */
const PUBLIC_SUFFIXES = [
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".woff",
  ".woff2",
  ".css",
  ".js",
  ".map",
  ".txt",
  ".webmanifest",
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLIC_SUFFIXES.some((s) => pathname.toLowerCase().endsWith(s))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(
    req.cookies.get(SESSION_COOKIE)?.value ||
    req.cookies.get(LEGACY_SESSION_COOKIE)?.value
  );

  // API routes answer with 401 rather than a redirect — a fetch() caller
  // wants a status code, not an HTML login page.
  if (pathname.startsWith("/api/")) {
    if (!hasSession) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Signed-out visitors to the root see the public landing page. It is a
  // rewrite, so the address bar stays on "/".
  if (!hasSession && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.rewrite(url);
  }

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    if (pathname !== "/") url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
