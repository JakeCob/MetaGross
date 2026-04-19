"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useModelPreference } from "@/stores/use-model-preference";
import type { PostMatchInput } from "@/lib/ai/battle-coach/post-match";

export interface PostMatchAnalysisCardProps {
  matchId: string;
  /** Full input the analyzer needs. Provided by the server page from the stored match. */
  input: PostMatchInput;
  /** Existing analysis, if the match has already been analyzed. */
  initial?: {
    opponentTeamMd: string;
    battleLogMd: string;
    generatedAt: number;
  } | null;
}

type Tab = "battle" | "opponent";

/**
 * Generates + displays the two post-match markdown docs:
 *   - Opponent team reconstruction
 *   - Battle log with strategy breakdown, turning points, mistakes, takeaways
 */
export function PostMatchAnalysisCard({
  matchId,
  input,
  initial = null,
}: PostMatchAnalysisCardProps) {
  const [analysis, setAnalysis] = useState(initial);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    initial ? "done" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("battle");
  const provider = useModelPreference((s) => s.provider);
  const modelId = useModelPreference((s) => s.modelId);

  const generate = useCallback(async () => {
    setStatus("running");
    setError(null);
    try {
      const res = await fetch("/api/battle-coach/post-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          input: { ...input, provider, modelName: modelId },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const data = (await res.json()) as typeof initial;
      setAnalysis(data);
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, [matchId, input]);

  const copy = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  }, []);

  const active =
    tab === "battle" ? analysis?.battleLogMd : analysis?.opponentTeamMd;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>AI Post-Match Analysis</span>
          <div className="flex items-center gap-2">
            {analysis && (
              <Badge variant="success" className="text-[10px]">
                Generated
              </Badge>
            )}
            {status === "running" && (
              <Badge variant="info" className="text-[10px] animate-pulse">
                Running…
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={generate}
              disabled={status === "running"}
            >
              {analysis ? "Re-run" : "Generate"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!analysis && status === "idle" && (
          <p className="text-sm text-muted-foreground">
            Click <strong>Generate</strong> to produce a full write-up of this
            match: the opponent&apos;s reconstructed team and a turn-by-turn
            breakdown with mistakes + improvements. Uses 2 Sonnet calls per
            match (≈ $0.04).
          </p>
        )}

        {status === "error" && (
          <p className="text-sm text-destructive">Error: {error}</p>
        )}

        {analysis && (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-border/50">
              <TabButton
                active={tab === "battle"}
                onClick={() => setTab("battle")}
              >
                Battle Log
              </TabButton>
              <TabButton
                active={tab === "opponent"}
                onClick={() => setTab("opponent")}
              >
                Opponent Team
              </TabButton>
              <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                Generated{" "}
                {new Date(analysis.generatedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px]"
                  onClick={() => copy(active ?? "")}
                  disabled={!active}
                >
                  Copy .md
                </Button>
              </span>
            </div>

            {/* Rendered markdown — plain text with whitespace preserved.
                A real markdown renderer can be slotted in later. */}
            <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border/50 bg-muted/20 p-4 text-[13px] leading-relaxed text-foreground font-sans">
              {active}
            </pre>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
      )}
    </button>
  );
}
