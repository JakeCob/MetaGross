"use client";

import { useState } from "react";
import type { MatchAnalysis, AIMatchAnalysis } from "@/lib/types/analysis";
import { WinProbChart } from "@/components/analysis/WinProbChart";
import { MatchSummary } from "@/components/analysis/MatchSummary";
import { TurnAnalysisDisplay } from "@/components/analysis/TurnAnalysisDisplay";
import { AIAnalysisCard } from "@/components/analysis/AIAnalysisCard";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface AnalysisViewProps {
  matchId: string;
  cachedAnalysis: MatchAnalysis | null;
  cachedAIAnalysis?: AIMatchAnalysis | null;
}

export function AnalysisView({ matchId, cachedAnalysis, cachedAIAnalysis }: AnalysisViewProps) {
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(cachedAnalysis);
  const [aiAnalysis, setAiAnalysis] = useState<AIMatchAnalysis | null>(cachedAIAnalysis ?? null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/analysis/${matchId}`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Analysis failed (${res.status})`);
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      if (data.aiAnalysis) {
        setAiAnalysis(data.aiAnalysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function runAIAnalysis() {
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch(`/api/analysis/${matchId}`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `AI analysis failed (${res.status})`);
      }

      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
      if (data.aiAnalysis) {
        setAiAnalysis(data.aiAnalysis);
      } else {
        setAiError("AI analysis was not generated. Check that ANTHROPIC_API_KEY is configured.");
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Run Analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Analyze this match to get win probability tracking, move grading,
            and turning point identification.
          </p>
          <Button onClick={runAnalysis} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              "Run Analysis"
            )}
          </Button>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="rule-analysis">
      <TabsList>
        <TabsTrigger value="rule-analysis">Rule Analysis</TabsTrigger>
        <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
        <TabsTrigger value="ask-metagross">Ask MetaGross</TabsTrigger>
      </TabsList>

      <TabsContent value="rule-analysis">
        <div className="space-y-6 pt-4">
          {/* Top row: Chart + Summary */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Win Probability</CardTitle>
                </CardHeader>
                <CardContent>
                  <WinProbChart
                    data={analysis.winProbabilityCurve}
                    turningPoints={analysis.turningPoints}
                  />
                </CardContent>
              </Card>
            </div>
            <div>
              <MatchSummary analysis={analysis} />
            </div>
          </div>

          {/* Turn-by-turn analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Turn-by-Turn Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.turnAnalyses.length > 0 ? (
                <div className="space-y-2">
                  {analysis.turnAnalyses.map((turn) => (
                    <TurnAnalysisDisplay key={turn.turnNumber} turnAnalysis={turn} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No turns to analyze.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="ai-analysis">
        <div className="pt-4">
          {aiAnalysis ? (
            <AIAnalysisCard analysis={aiAnalysis} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>AI Coach Analysis</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 py-8">
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Get AI-powered coaching feedback with specific improvements,
                  turning point analysis, and performance assessment.
                </p>
                <Button onClick={runAIAnalysis} disabled={aiLoading} variant="secondary">
                  {aiLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating AI Analysis...
                    </span>
                  ) : (
                    "Generate AI Analysis"
                  )}
                </Button>
                {aiError && (
                  <p className="text-sm text-red-400">{aiError}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="ask-metagross" keepMounted>
        <div className="pt-4 h-[600px]">
          <AgentPanel contextType="match" contextId={matchId} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
