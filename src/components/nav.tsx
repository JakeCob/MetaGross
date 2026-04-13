import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teams", label: "Teams" },
  { href: "/battles", label: "Battles" },
  { href: "/meta", label: "Meta" },
  { href: "/champions", label: "Champions" },
  { href: "/meta/tournaments", label: "Tournaments" },
  { href: "/strategy", label: "Strategy" },
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-foreground"
        >
          <span className="text-primary">Meta</span>Gross
        </Link>
        <ul className="flex items-center gap-1">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <ThemeToggle />
          </li>
        </ul>
      </nav>
    </header>
  );
}
