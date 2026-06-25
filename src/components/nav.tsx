"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

interface NavLink {
  href: string;
  label: string;
}
interface NavGroup {
  label: string;
  items: NavLink[];
}
type NavEntry = NavLink | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).items !== undefined;
}

// Grouped navigation — collapses the long flat list into a few dropdowns.
const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  {
    label: "Teams",
    items: [
      { href: "/teams", label: "Team Builder" },
      { href: "/team-archive", label: "Archive" },
    ],
  },
  {
    label: "Battles",
    items: [
      { href: "/battles", label: "Battle Log" },
      { href: "/strategy", label: "Strategy" },
    ],
  },
  {
    label: "Meta",
    items: [
      { href: "/meta", label: "Overview" },
      { href: "/meta/regulation", label: "Reg Analysis" },
      { href: "/champions", label: "Champions" },
      { href: "/meta/tournaments", label: "Tournaments" },
    ],
  },
  { href: "/settings/memory", label: "Memory" },
];

/** Longest-prefix active match so e.g. /meta/regulation doesn't light up /meta. */
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function groupActive(pathname: string | null, group: NavGroup): boolean {
  return group.items.some((i) => isActive(pathname, i.href));
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
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

        {/* Desktop — standalone links + grouped dropdowns */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV.map((entry) =>
            isGroup(entry) ? (
              <li key={entry.label}>
                <NavDropdown
                  group={entry}
                  active={groupActive(pathname, entry)}
                  pathname={pathname}
                />
              </li>
            ) : (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(pathname, entry.href)
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {entry.label}
                </Link>
              </li>
            ),
          )}
          <li>
            <ThemeToggle />
          </li>
          <li>
            <SignOutButton />
          </li>
        </ul>

        {/* Mobile: theme toggle + hamburger */}
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

      {/* Mobile drawer — groups become labelled sections */}
      {open && (
        <div className="border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
          <ul
            className="mx-auto flex max-w-6xl flex-col px-2 py-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
          >
            {NAV.map((entry) =>
              isGroup(entry) ? (
                <li key={entry.label} className="mt-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {entry.label}
                  </p>
                  {entry.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={`block rounded-lg px-4 py-2.5 text-base font-medium transition-colors ${
                        isActive(pathname, i.href)
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {i.label}
                    </Link>
                  ))}
                </li>
              ) : (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className={`block rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                      isActive(pathname, entry.href)
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {entry.label}
                  </Link>
                </li>
              ),
            )}
            <li className="mt-1 border-t border-border pt-1">
              <SignOutButton className="w-full justify-start rounded-lg px-4 py-3 text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground" />
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

function NavDropdown({
  group,
  active,
  pathname,
}: {
  group: NavGroup;
  active: boolean;
  pathname: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active || open
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        {group.label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[10rem] rounded-lg border border-border bg-popover p-1 shadow-xl">
          {group.items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(pathname, i.href)
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {i.label}
            </Link>
          ))}
        </div>
      )}
    </div>
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
      className={
        className ?? "text-sm text-muted-foreground hover:text-foreground"
      }
    >
      Sign out
    </button>
  );
}
