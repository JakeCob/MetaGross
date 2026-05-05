"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({
  initialSetup = false,
}: {
  initialSetup?: boolean;
}) {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  // Only trust the server-rendered `initialSetup` (computed in the
  // login page from `process.env`). The URL `?setup=1` flag is
  // legacy from an earlier middleware version and would lie when
  // the user navigates to a stale URL.
  const setupHint = initialSetup;

  const [passcode, setPasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Skip SSR for the form. Password-manager extensions (LastPass,
  // 1Password, Bitwarden, etc.) inject child DOM into password inputs
  // *after* the server-rendered HTML lands. React 19's
  // suppressHydrationWarning only covers attribute/text mismatches on
  // the same element — it doesn't tolerate ADDED CHILD nodes. So we
  // render nothing on the server and let the client be the first to
  // mount the form. Login isn't SEO-relevant; SSR provides no value.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Sign-in failed");
        setSubmitting(false);
        return;
      }
      // Use replace + a hard-refresh so middleware re-evaluates with
      // the new cookie. Soft router.replace skips middleware on the
      // first navigation and the page can briefly think we're
      // unauthed.
      window.location.replace(body.redirect || next || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setSubmitting(false);
    }
  };

  if (!mounted) {
    // Server-side and first paint: render an empty card with matching
    // dimensions so layout doesn't jump. The form materializes on the
    // client effect tick.
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <span className="text-primary">Meta</span>Gross
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading…</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <span className="text-primary">Meta</span>Gross
        </CardTitle>
      </CardHeader>
      <CardContent>
        {setupHint && (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Auth isn&rsquo;t configured. Set{" "}
            <code className="font-mono">METAGROSS_AUTH_SECRET</code> (≥16
            chars) and <code className="font-mono">METAGROSS_PASSCODE</code> in
            your <code className="font-mono">.env</code>, then restart the
            server.
          </div>
        )}
        {/* suppressHydrationWarning on the form: password-manager
            extensions (LastPass, 1Password, Bitwarden, etc.) inject
            their own DOM children INTO password inputs after the
            server-rendered HTML lands. Without this flag React 19
            throws a hydration mismatch even though the markup is
            otherwise correct. The extension's mutation only happens
            on the client, so suppression is safe. */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3"
          suppressHydrationWarning
        >
          <label
            className="flex flex-col gap-1.5 text-sm"
            suppressHydrationWarning
          >
            <span className="text-foreground">Passcode</span>
            <Input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              disabled={submitting}
              required
              suppressHydrationWarning
            />
          </label>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={submitting || !passcode}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            This app is gated by a single passcode set in the server&rsquo;s
            environment. Only people with the passcode can access it.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
