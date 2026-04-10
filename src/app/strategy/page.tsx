import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function StrategyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Pre-Match Strategy</h1>
        <p className="mt-1 text-muted">Plan your game before it starts. Get lead and play-style recommendations.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Select your team and your opponent&apos;s team preview to get
              lead recommendations and matchup analysis.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              AI-suggested leads with reasoning based on speed tiers,
              type matchups, and common opponent strategies.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Game Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Win conditions, key threats to manage, and optimal
              positioning for your team composition.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Threat Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Identify the biggest threats on the opponent&apos;s team and
              which of your Pokemon handle them best.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
