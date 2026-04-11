"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RecentMatch {
  id: string;
  result: string | null;
  playedAt: number | null;
  opponentName: string | null;
  opponentLeads: string[];
}

interface RecentMatchesProps {
  matches: RecentMatch[];
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RecentMatches({ matches }: RecentMatchesProps) {
  const recent = matches.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Matches</CardTitle>
          <Link
            href="/battles"
            className="text-sm text-primary hover:underline"
          >
            View All
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matches recorded yet. Start logging battles to see results here.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((m) => (
              <Link
                key={m.id}
                href={`/battles/${m.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={m.result === "win" ? "success" : "error"}
                  >
                    {m.result === "win" ? "W" : "L"}
                  </Badge>
                  <div>
                    {m.opponentName && (
                      <p className="text-sm font-medium text-foreground">
                        vs {m.opponentName}
                      </p>
                    )}
                    {m.opponentLeads.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Opp leads: {m.opponentLeads.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(m.playedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
