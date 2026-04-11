import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Track your win/loss record, rating trends, and performance metrics.",
  },
  {
    href: "/teams",
    title: "Teams",
    description: "Build, analyze, and optimize your VGC teams with EV calculators.",
  },
  {
    href: "/battles",
    title: "Battles",
    description: "Log matches, review replays, and get AI-powered analysis.",
  },
  {
    href: "/strategy",
    title: "Strategy",
    description: "Pre-match planning, lead recommendations, and game plans.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="flex w-full flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="text-primary">Meta</span>Gross
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Supercomputer-level team intelligence for Pokemon VGC.
          AI-powered battle analysis, team building, and coaching.
        </p>
      </section>

      {/* Feature Cards */}
      <section className="mx-auto grid w-full max-w-4xl gap-4 px-4 pb-24 sm:grid-cols-2">
        {features.map((feature) => (
          <Link key={feature.href} href={feature.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardContent>
                <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                  {feature.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
