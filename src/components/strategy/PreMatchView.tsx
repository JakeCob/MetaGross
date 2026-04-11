"use client";

import type { PreMatchStrategy } from "@/lib/types/analysis";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PreMatchViewProps {
  strategy: PreMatchStrategy;
}

export function PreMatchView({ strategy }: PreMatchViewProps) {
  return (
    <div className="space-y-4">
      {/* Game Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Game Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{strategy.gamePlan}</p>
          <div className="mt-3 rounded-lg border border-foreground/5 bg-muted/30 p-3">
            <h4 className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Win Condition
            </h4>
            <p className="text-sm">{strategy.winCondition}</p>
          </div>
        </CardContent>
      </Card>

      {/* Leads & Bring 4 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recommended Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Recommended Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-2">
              {strategy.recommendedLeads.species.map((species) => (
                <Badge key={species} variant="info">
                  {species}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {strategy.recommendedLeads.reasoning}
            </p>
          </CardContent>
        </Card>

        {/* Bring 4 */}
        <Card>
          <CardHeader>
            <CardTitle>Bring 4</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              {strategy.recommendedBring4.species.map((species) => (
                <Badge key={species} variant="secondary">
                  {species}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {strategy.recommendedBring4.reasoning}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Key Threats */}
      {strategy.keyThreats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Threats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {strategy.keyThreats.map((threat, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-foreground/5 bg-muted/30 p-3"
                >
                  <Badge variant="destructive" className="shrink-0 mt-0.5">
                    {threat.species}
                  </Badge>
                  <p className="text-sm leading-relaxed">{threat.threat}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mega Timing */}
      {strategy.megaTiming && (
        <Card>
          <CardHeader>
            <CardTitle>Mega Evolution Timing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{strategy.megaTiming}</p>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">Powered by Claude</p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
