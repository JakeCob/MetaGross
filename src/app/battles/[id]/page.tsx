import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMatchById } from "@/lib/db/queries/matches";
import { DeleteMatchButton } from "@/components/battle-logger/DeleteMatchButton";
import { PostMatchAnalysisCard } from "@/components/battle-logger/PostMatchAnalysisCard";
import type { PostMatchInput } from "@/lib/ai/battle-coach/post-match";
import type { Turn } from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { ScoutingResult } from "@/lib/ai/opponent-scouting/types";
import { ACTIVE_REGULATION_FORMAT_ID } from "@/lib/data/champions";

function jsonOrNull<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "Unknown date";
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
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
      return "Quick Log";
    default:
      return mode ?? "Unknown";
  }
}

interface PokemonInfo {
  species: string;
  item?: string;
  ability?: string;
}

function parsePokemonList(raw: unknown): PokemonInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    if (typeof p === "string") return { species: p };
    if (p && typeof p === "object") {
      const obj = p as Record<string, unknown>;
      return {
        species: (obj.species as string) ?? "Unknown",
        item: (obj.item as string) ?? undefined,
        ability: (obj.ability as string) ?? undefined,
      };
    }
    return { species: "Unknown" };
  });
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchById(id);

  if (!match) {
    notFound();
  }

  const isWin = match.result === "win";
  const myTeam = parsePokemonList(match.myTeam);
  const opponentTeam = parsePokemonList(match.opponentTeam);
  const myBrought = parseStringArray(match.myBrought);
  const oppBrought = parseStringArray(match.opponentBrought);
  const myLeads = parseStringArray(match.myLeads);
  const oppLeads = parseStringArray(match.opponentLeads);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Match Detail</h1>
            <Badge variant={isWin ? "success" : "error"} className="text-sm">
              {isWin ? "Win" : "Loss"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{formatDate(match.playedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/battles/${id}/analysis`} className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto">View Analysis</Button>
          </Link>
          <DeleteMatchButton matchId={id} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Match summary */}
          <Card>
            <CardHeader>
              <CardTitle>Match Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Result</span>
                  <div className="mt-1">
                    <Badge variant={isWin ? "success" : "error"}>
                      {isWin ? "Win" : "Loss"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Mode</span>
                  <p className="mt-1 font-medium text-foreground">
                    {modeLabel(match.mode)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Format</span>
                  <p className="mt-1 font-medium text-foreground">
                    {match.format ?? "Unknown"}
                  </p>
                </div>
                {match.opponentName && (
                  <div>
                    <span className="text-muted-foreground">Opponent</span>
                    <p className="mt-1 font-medium text-foreground">
                      {match.opponentName}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* My Team */}
          <Card>
            <CardHeader>
              <CardTitle>My Team</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {myTeam.map((mon, i) => {
                  const wasBrought = myBrought.includes(mon.species);
                  const wasLead = myLeads.includes(mon.species);
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col rounded-lg border p-3 transition-colors ${
                        wasBrought
                          ? "border-primary/40 bg-accent/5"
                          : "border-border bg-card opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {mon.species}
                        </span>
                        {wasLead && (
                          <Badge
                            variant="success"
                            className="text-[10px] px-1.5 py-0"
                          >
                            Lead
                          </Badge>
                        )}
                      </div>
                      {mon.item && (
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {mon.item}
                        </span>
                      )}
                      {!wasBrought && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          Not brought
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Opponent Team */}
          <Card>
            <CardHeader>
              <CardTitle>Opponent Team</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {opponentTeam.map((mon, i) => {
                  const wasBrought = oppBrought.includes(mon.species);
                  const wasLead = oppLeads.includes(mon.species);
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col rounded-lg border p-3 transition-colors ${
                        wasBrought
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-border bg-card opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {mon.species}
                        </span>
                        {wasLead && (
                          <Badge
                            variant="warning"
                            className="text-[10px] px-1.5 py-0"
                          >
                            Lead
                          </Badge>
                        )}
                      </div>
                      {mon.item && (
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {mon.item}
                        </span>
                      )}
                      {mon.ability && (
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {mon.ability}
                        </span>
                      )}
                      {!wasBrought && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          Not brought
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Turn-by-turn placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Turn-by-Turn</CardTitle>
            </CardHeader>
            <CardContent>
              {match.turns.length > 0 ? (
                <div className="space-y-2">
                  {match.turns.map((turn) => (
                    <div
                      key={turn.id}
                      className="rounded-md border border-border bg-background p-2 text-xs"
                    >
                      <span className="font-medium">
                        Turn {turn.turnNumber}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {turn.actions.length} action
                        {turn.actions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No turn data recorded. Turn-by-turn logging will be
                  available in a future update.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Player Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {match.notes ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {match.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No notes recorded for this match.
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI post-match analysis */}
          <PostMatchAnalysisCard
            matchId={match.id}
            input={{
              result: (match.result as "win" | "loss") ?? "win",
              mode: (match.mode as "realtime" | "quick") ?? "realtime",
              format: match.format ?? ACTIVE_REGULATION_FORMAT_ID,
              opponentName: match.opponentName ?? "",
              notes: match.notes ?? "",
              myTeam: (jsonOrNull<TeamPokemon[]>(match.myTeam) ?? []),
              opponentTeam:
                jsonOrNull<Partial<TeamPokemon>[]>(match.opponentTeam) ?? [],
              myBrought: jsonOrNull<string[]>(match.myBrought) ?? [],
              opponentBrought:
                jsonOrNull<string[]>(match.opponentBrought) ?? [],
              myLeads: jsonOrNull<string[]>(match.myLeads) ?? [],
              opponentLeads: jsonOrNull<string[]>(match.opponentLeads) ?? [],
              turns: (match.turns as unknown as Turn[]) ?? [],
              faintedP1: [],
              faintedP2: [],
              scouting: jsonOrNull<ScoutingResult>(
                match.opponentScoutingJson,
              ) ?? null,
            } satisfies PostMatchInput}
            initial={jsonOrNull(match.aiAnalysisJson)}
          />

          {/* Back link */}
          <Link href="/battles">
            <Button variant="outline" className="w-full">
              Back to Match History
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
