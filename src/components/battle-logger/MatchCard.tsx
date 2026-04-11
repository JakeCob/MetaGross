"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface MatchCardData {
  id: string;
  result: string | null;
  mode: string | null;
  format: string | null;
  playedAt: number | null;
  opponentName: string | null;
  myLeads: string[];
  opponentLeads: string[];
  myBrought: string[];
  opponentBrought: string[];
  notes: string | null;
}

export interface MatchCardProps {
  match: MatchCardData;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "Unknown date";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function modeLabel(mode: string | null): string {
  switch (mode) {
    case "realtime":
      return "Real-Time";
    case "postmatch":
      return "Post-Match";
    case "quick":
      return "Quick";
    default:
      return mode ?? "Unknown";
  }
}

export function MatchCard({ match }: MatchCardProps) {
  const isWin = match.result === "win";

  return (
    <Link href={`/battles/${match.id}`}>
      <Card
        className={`transition-all hover:border-primary/40 ${
          isWin ? "border-l-success border-l-2" : "border-l-destructive border-l-2"
        }`}
      >
        <CardContent>
          <div className="flex flex-col gap-3">
            {/* Top row: result, mode, date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={isWin ? "success" : "error"}>
                  {isWin ? "Win" : "Loss"}
                </Badge>
                <Badge>{modeLabel(match.mode)}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(match.playedAt)}
              </span>
            </div>

            {/* Opponent name */}
            {match.opponentName && (
              <p className="text-sm text-foreground">
                vs <span className="font-medium">{match.opponentName}</span>
              </p>
            )}

            {/* Leads display */}
            {(match.myLeads.length > 0 || match.opponentLeads.length > 0) && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">My leads:</span>
                  {match.myLeads.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <span className="text-muted-foreground">vs</span>
                <div className="flex items-center gap-1">
                  {match.opponentLeads.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes preview */}
            {match.notes && (
              <p className="text-xs text-muted-foreground line-clamp-1">{match.notes}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
