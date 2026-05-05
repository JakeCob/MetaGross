"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teams", label: "Teams" },
  { href: "/team-archive", label: "Archive" },
  { href: "/battles", label: "Battles" },
  { href: "/meta", label: "Meta" },
  { href: "/champions", label: "Champions" },
  { href: "/meta/tournaments", label: "Tournaments" },
  { href: "/strategy", label: "Strategy" },
  { href: "/settings/memory", label: "Memory" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation so the user doesn't have to tap
  // outside it manually after a link tap.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-foreground"
        >
          <span className="text-primary">Meta</span>Gross
        </Link>

        {/* Desktop links — hidden on small screens. The 8-link nav
            doesn't fit on mobile, so it folds into a hamburger drawer. */}
        <ul className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li>
            <ThemeToggle />
          </li>
          <li>
            <SignOutButton />
          </li>
        </ul>

        {/* Mobile: theme toggle + hamburger button */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-accent"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-sm">
          <ul
            className="mx-auto flex max-w-6xl flex-col px-2 py-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
          >
            {navLinks.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                      active
                        ? "text-foreground bg-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-1 border-t border-border pt-1">
              <SignOutButton className="w-full justify-start rounded-lg px-4 py-3 text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground" />
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.replace("/login");
      }}
      className={className ?? "text-sm text-muted-foreground hover:text-foreground"}
    >
      Sign out
    </button>
  );
}
