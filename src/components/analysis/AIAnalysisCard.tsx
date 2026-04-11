"use client";

import type { AIMatchAnalysis } from "@/lib/types/analysis";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AIAnalysisCardProps {
  analysis: AIMatchAnalysis;
}

export function AIAnalysisCard({ analysis }: AIAnalysisCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Coach Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Summary</h4>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Key Turning Points */}
        {analysis.keyTurningPoints.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              Key Turning Points
            </h4>
            <div className="space-y-2">
              {analysis.keyTurningPoints.map((tp, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-foreground/5 bg-muted/30 p-3"
                >
                  <Badge variant="secondary" className="shrink-0 mt-0.5">
                    Turn {tp.turn}
                  </Badge>
                  <p className="text-sm leading-relaxed">{tp.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improvements */}
        {analysis.improvements.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              Areas for Improvement
            </h4>
            <ul className="space-y-1.5">
              {analysis.improvements.map((imp, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="leading-relaxed">{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Strengths */}
        {analysis.strengths.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              Strengths
            </h4>
            <ul className="space-y-1.5">
              {analysis.strengths.map((str, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  <span className="leading-relaxed">{str}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Overall Assessment */}
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">
            Overall Assessment
          </h4>
          <p className="text-sm leading-relaxed">{analysis.overallAssessment}</p>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">Powered by Claude</p>
      </CardFooter>
    </Card>
  );
}
