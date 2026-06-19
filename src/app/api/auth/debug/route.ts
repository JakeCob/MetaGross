import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/auth/debug
 *
 * Reports whether the auth env vars are loaded WITHOUT exposing
 * their values. Public-but-low-info: anyone can read the response
 * and only learns "they're set" / "they're not set" / lengths.
 *
 * Removable once your auth setup is stable — the route file can be
 * deleted at any time.
 */
export async function GET() {
  return NextResponse.json({
    hasPasscode: Boolean(process.env.METAGROSS_PASSCODE),
    passcodeLength: (process.env.METAGROSS_PASSCODE ?? "").length,
    hasAuthSecret: Boolean(process.env.METAGROSS_AUTH_SECRET),
    authSecretLength: (process.env.METAGROSS_AUTH_SECRET ?? "").length,
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    cronSecretLength: (process.env.CRON_SECRET ?? "").length,
    nodeEnv: process.env.NODE_ENV,
    runtime: "nodejs",
  });
}
