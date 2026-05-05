import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * Single-user passcode middleware.
 *
 * Runs on the Node.js runtime (not Edge) because Turbopack's Edge
 * bundler in Next 16 sometimes inlines env values at compile time
 * and misses `.env` edits made after the dev server started. Node
 * runtime reads `process.env` lazily on every request — same
 * behavior as the API routes themselves.
 *
 * Public exemptions: /login, /api/auth/*, Next internals, static
 * assets, and the auth-debug endpoint. Everything else needs a
 * valid HMAC-signed session cookie.
 */

export const runtime = "nodejs";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/debug",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/robots.txt",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/health") return true;
  // Files with extensions (icons, images, fonts) — let them through.
  if (/\.[a-z0-9]{1,5}$/i.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  // verifySessionToken is fail-closed: if the env secret is missing,
  // it returns false and the user gets bounced to /login. The login
  // page then surfaces the setup hint via its own server-side env
  // check (which is reliably loaded on the Node runtime).
  const ok = await verifySessionToken(token);
  if (ok) {
    return NextResponse.next();
  }

  // API requests get a 401, not a redirect — clients (the UI's fetch
  // calls) don't expect HTML in response bodies.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Page request — bounce to /login with a `next=` query param so
  // post-login can return the user to where they were headed.
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname + (search ?? ""));
  return NextResponse.redirect(url);
}

export const config = {
  // Match every path. Public paths are exempted inside the function
  // — keeping the matcher coarse means we never accidentally let a
  // future route slip past auth.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
