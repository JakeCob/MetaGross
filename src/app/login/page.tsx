import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in — MetaGross",
};

export default function LoginPage() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
