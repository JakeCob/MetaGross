import { getMatchById } from "@/lib/db/queries/matches";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { MatchAnalysis, AIMatchAnalysis } from "@/lib/types/analysis";
import { AnalysisView } from "./AnalysisView";

export default async function MatchAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchById(id);

  if (!match) {
    notFound();
  }

  const cachedAnalysis = match.ruleAnalysisJson as MatchAnalysis | null;
  const cachedAIAnalysis = match.aiAnalysisJson as AIMatchAnalysis | null;
  const hasTurns = match.turns.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Match Analysis</h1>
          <Badge variant="info">Match {id.slice(0, 8)}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          Rule-based analysis with win probability tracking and move grading.
        </p>
      </div>

      {!hasTurns ? (
        <Card>
          <CardHeader>
            <CardTitle>No Turn Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This match does not have turn-by-turn data recorded.
              Analysis requires detailed turn data to calculate win probability
              and grade moves. Try logging a match with the real-time or
              post-match mode to get full analysis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <AnalysisView matchId={id} cachedAnalysis={cachedAnalysis} cachedAIAnalysis={cachedAIAnalysis} />
      )}
    </div>
  );
}
