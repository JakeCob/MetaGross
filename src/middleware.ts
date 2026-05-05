import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * Single-user passcode middleware.
 *
 * Every request needs a valid HMAC-signed session cookie except:
 *   - `/login` and the auth API
 *   - Next.js internals (_next, static assets, favicon)
 *   - Health-check endpoints we want unauthenticated for monitoring
 *
 * The matcher (bottom of file) runs this middleware on every route
 * by default; the early `isPublic` check exits cheaply for the
 * exempted paths.
 */

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/robots.txt",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/health") return true;
  // Static assets in /public are usually small images and icons —
  // allow extensionless icons fall through, only let real files
  // through (they have an extension).
  if (/\.[a-z0-9]{1,5}$/i.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Auth not configured → fail closed with a clear message instead
  // of letting unauthed traffic through. This is the default state
  // when METAGROSS_AUTH_SECRET / METAGROSS_PASSCODE haven't been set.
  const secret =
    process.env.METAGROSS_AUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
  if (!secret || secret.length < 16) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error:
            "Auth not configured. Set METAGROSS_AUTH_SECRET (≥16 chars) and METAGROSS_PASSCODE in .env, then restart.",
        },
        { status: 503 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("setup", "1");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const ok = await verifySessionToken(token, secret);
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
