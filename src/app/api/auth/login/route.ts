import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  issueSessionToken,
  requireAuthSecret,
  requirePasscode,
  timingSafeEqual,
} from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/login
 *
 * Body: { passcode: string, next?: string }
 *
 * Verifies the passcode against METAGROSS_PASSCODE (timing-safe).
 * On success: HTTP-only signed-session cookie + 200 with `{ ok: true,
 * redirect }`. Caller (the login page) does the navigation client-
 * side so the cookie is in place before the next render.
 */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const passcode = (body as { passcode?: unknown }).passcode;
  const nextPath = (body as { next?: unknown }).next;

  if (typeof passcode !== "string" || passcode.length === 0) {
    return NextResponse.json(
      { error: "Passcode is required" },
      { status: 400 },
    );
  }

  let configuredPasscode: string;
  let secret: string;
  try {
    configuredPasscode = requirePasscode();
    secret = requireAuthSecret();
  } catch (err) {
    // Misconfigured server — shouldn't 401 (looks like a wrong
    // passcode); 503 makes the cause obvious.
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Auth not configured on the server.",
      },
      { status: 503 },
    );
  }

  if (!timingSafeEqual(passcode, configuredPasscode)) {
    // Mild artificial delay so trivial brute-force attempts feel slow
    // even on localhost. ~150ms.
    await new Promise((r) => setTimeout(r, 150));
    return NextResponse.json(
      { error: "Incorrect passcode" },
      { status: 401 },
    );
  }

  const token = await issueSessionToken(secret);
  const safeNext =
    typeof nextPath === "string" &&
    nextPath.startsWith("/") &&
    !nextPath.startsWith("//")
      ? nextPath
      : "/";

  const response = NextResponse.json({ ok: true, redirect: safeNext });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return response;
}
