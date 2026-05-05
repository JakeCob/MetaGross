import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in — MetaGross",
};

// Force per-request rendering so isAuthConfigured() reads `process.env`
// at request time, not at build time. Without this, Next.js can
// statically pre-render the login page and inline whatever value
// `METAGROSS_AUTH_SECRET` had when the dev server compiled — usually
// empty if `.env` was edited after startup.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-side env check. Runs on the Node runtime, so `process.env`
 * is reliably populated from `.env` regardless of the Turbopack
 * middleware-bundling quirks. Whatever this evaluates to gets passed
 * to the client form so the setup banner reflects the real state of
 * the server, not a stale middleware redirect param.
 */
function isAuthConfigured(): boolean {
  const secret =
    process.env.METAGROSS_AUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
  const passcode = process.env.METAGROSS_PASSCODE ?? "";
  return secret.length >= 16 && passcode.length > 0;
}

export default function LoginPage() {
  const setup = !isAuthConfigured();
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <Suspense
        fallback={
          <div className="text-sm text-muted-foreground">Loading…</div>
        }
      >
        <LoginForm initialSetup={setup} />
      </Suspense>
    </div>
  );
}
