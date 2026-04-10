import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MatchAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Match Analysis</h1>
          <Badge variant="info">Match {id}</Badge>
        </div>
        <p className="mt-1 text-muted">AI-powered breakdown and coaching insights.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              A natural-language summary of the match, key decisions,
              and turning points will be generated here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision Grades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Move-by-move grading with expected value calculations.
              Each decision rated from optimal to critical mistake.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Damage Calcs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Key damage calculations from the match, showing what
              benchmarks were hit or missed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coaching Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Personalized improvement suggestions based on patterns
              observed across your match history.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
