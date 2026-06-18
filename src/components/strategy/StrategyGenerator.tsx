"use client";

import { useState } from "react";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { PreMatchStrategy } from "@/lib/types/analysis";
import { PreMatchView } from "./PreMatchView";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ACTIVE_REGULATION_LABEL,
  ACTIVE_REGULATION_FORMAT_ID,
} from "@/lib/data/champions";

interface StrategyGeneratorProps {
  savedTeams?: { id: string; name: string; pokemon: TeamPokemon[] }[];
}

export function StrategyGenerator({ savedTeams = [] }: StrategyGeneratorProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [opponentInput, setOpponentInput] = useState("");
  const [format, setFormat] = useState(ACTIVE_REGULATION_FORMAT_ID);
  const [strategy, setStrategy] = useState<PreMatchStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = savedTeams.find((t) => t.id === selectedTeamId);

  function parseOpponentTeam(input: string): Partial<TeamPokemon>[] {
    // Parse comma-separated species names (basic team preview)
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((species) => ({ species }));
  }

  async function generateStrategy() {
    if (!selectedTeam) {
      setError("Please select your team.");
      return;
    }

    const opponentTeam = parseOpponentTeam(opponentInput);
    if (opponentTeam.length === 0) {
      setError("Please enter at least one opponent Pokemon.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/strategy/pre-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          myTeam: selectedTeam.pokemon,
          opponentTeam,
          format,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || `Strategy generation failed (${res.status})`,
        );
      }

      const data = await res.json();
      setStrategy(data.strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Strategy generation failed");
    } finally {
      setLoading(false);
    }
  }

  if (strategy) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Strategy Generated</h2>
          <Button variant="outline" onClick={() => setStrategy(null)}>
            New Strategy
          </Button>
        </div>
        <PreMatchView strategy={strategy} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* My Team Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Your Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedTeams.length > 0 ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Select a saved team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Choose team...</option>
                {savedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.pokemon.map((p) => p.species).join(", ")})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No saved teams found. Build a team first in the Team Builder.
            </p>
          )}

          {selectedTeam && (
            <div className="rounded-lg border border-foreground/5 bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Selected Team
              </p>
              <p className="text-sm">
                {selectedTeam.pokemon.map((p) => p.species).join(", ")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opponent Team Input */}
      <Card>
        <CardHeader>
          <CardTitle>Opponent Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Enter opponent&apos;s Pokemon (comma-separated)
            </label>
            <textarea
              value={opponentInput}
              onChange={(e) => setOpponentInput(e.target.value)}
              placeholder="e.g. Metagross, Incineroar, Rillaboom, Tornadus, Kyogre, Amoonguss"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={ACTIVE_REGULATION_FORMAT_ID}>{ACTIVE_REGULATION_LABEL}</option>
              <option value="vgc-reg-g">VGC Regulation G</option>
              <option value="vgc-reg-h">VGC Regulation H</option>
            </select>
          </div>

          <Button
            onClick={generateStrategy}
            disabled={loading || !selectedTeamId || !opponentInput.trim()}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating Strategy...
              </span>
            ) : (
              "Generate Strategy"
            )}
          </Button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
