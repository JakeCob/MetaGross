"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBattleLogger } from "@/stores/use-battle-logger";
import { NewBattleDialog } from "@/components/battle-logger/NewBattleDialog";
import { OpponentTeamEntry } from "@/components/battle-logger/OpponentTeamEntry";
import { TeamPreview } from "@/components/battle-logger/TeamPreview";
import { BattleResult } from "@/components/battle-logger/BattleResult";
import { BattleLogger } from "@/components/battle-logger/BattleLogger";
import { PostMatchEditor } from "@/components/battle-logger/PostMatchEditor";
import type { BattleMode, BattleResult as BattleResultType } from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
const STEPS = [
  { key: "mode", label: "Mode" },
  { key: "myTeam", label: "My Team" },
  { key: "oppTeam", label: "Opponent" },
  { key: "preview", label: "Preview" },
  { key: "battle", label: "Battle" },
  { key: "result", label: "Result" },
] as const;

type Step = (typeof STEPS)[number]["key"];

// ---------------------------------------------------------------------------
// Minimal team shape returned from /api/teams
// ---------------------------------------------------------------------------
interface ApiTeam {
  id: string;
  name: string;
  format: string | null;
  isActive: number | null;
  pokemon: {
    species: string;
    ability: string;
    item: string | null;
    nature: string | null;
    level: number | null;
    megaEvolution: string | null;
    teraType: string | null;
    moves: unknown;
    evs: unknown;
    ivs: unknown;
  }[];
}

function toTeamPokemon(raw: ApiTeam["pokemon"][number]): TeamPokemon {
  const moves = Array.isArray(raw.moves) ? raw.moves : [];
  const evs =
    raw.evs && typeof raw.evs === "object"
      ? (raw.evs as TeamPokemon["evs"])
      : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const ivs =
    raw.ivs && typeof raw.ivs === "object"
      ? (raw.ivs as TeamPokemon["ivs"])
      : { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

  return {
    species: raw.species,
    ability: raw.ability,
    item: raw.item ?? "",
    nature: raw.nature ?? "Hardy",
    level: raw.level ?? 50,
    megaEvolution: raw.megaEvolution ?? undefined,
    teraType: raw.teraType ?? undefined,
    moves: [
      (moves[0] as string) ?? "",
      (moves[1] as string) ?? "",
      (moves[2] as string) ?? "",
      (moves[3] as string) ?? "",
    ],
    evs,
    ivs,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function NewBattlePage() {
  const router = useRouter();
  const store = useBattleLogger();

  // Current wizard step
  const [step, setStep] = useState<Step>("mode");
  const [saving, setSaving] = useState(false);

  // Team selection
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Auto-detect step from persisted store state on mount
  useEffect(() => {
    if (store.phase === "idle" || !store.mode) {
      setStep("mode");
    } else if (store.phase === "teamEntry" && store.myTeam.length === 0) {
      setStep("myTeam");
    } else if (store.phase === "teamEntry" && store.opponentTeam.length === 0) {
      setStep("oppTeam");
    } else if (store.phase === "teamPreview") {
      setStep("preview");
    } else if (store.phase === "inProgress") {
      // For realtime/postmatch, show the battle logger; for quick, skip to result
      if (store.mode === "quick") {
        setStep("result");
      } else {
        setStep("battle");
      }
    } else if (store.phase === "complete") {
      setStep("result");
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch teams when entering myTeam step
  useEffect(() => {
    if (step !== "myTeam") return;
    let cancelled = false;
    setTeamsLoading(true);
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTeams(data.teams ?? []);
      })
      .catch(() => {
        // silently fail — user can retry
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  // -------------------------------------------------------------------------
  // Step handlers
  // -------------------------------------------------------------------------
  const handleModeSelect = useCallback(
    (mode: BattleMode) => {
      store.startBattle(mode);
      setStep("myTeam");
    },
    [store],
  );

  const handleTeamSelect = useCallback(
    (team: ApiTeam) => {
      const pokemon = team.pokemon.map(toTeamPokemon);
      store.setMyTeam(pokemon, team.id);
      setStep("oppTeam");
    },
    [store],
  );

  const handleOpponentComplete = useCallback(
    (oppTeam: Partial<TeamPokemon>[]) => {
      store.setOpponentTeam(oppTeam);
      store.proceedToTeamPreview();
      setStep("preview");
    },
    [store],
  );

  const handlePreviewComplete = useCallback(
    (data: {
      myBrought: string[];
      opponentBrought: string[];
      myLeads: string[];
      opponentLeads: string[];
    }) => {
      store.setMyBrought(data.myBrought);
      store.setOpponentBrought(data.opponentBrought);
      store.setMyLeads(data.myLeads);
      store.setOpponentLeads(data.opponentLeads);
      store.proceedToBattle();

      // Route based on mode
      if (store.mode === "quick") {
        setStep("result");
      } else {
        store.initializeBattle();
        setStep("battle");
      }
    },
    [store],
  );

  const handleEndBattle = useCallback(() => {
    setStep("result");
  }, []);

  const handleSave = useCallback(
    async (result: BattleResultType) => {
      store.endBattle(result);
      setSaving(true);

      // Build payload from current store + the result we just set
      const state = useBattleLogger.getState();
      const payload = {
        format: state.format,
        mode: state.mode,
        result,
        myTeam: state.myTeam,
        myTeamId: state.myTeamId,
        opponentTeam: state.opponentTeam,
        myBrought: state.myBrought,
        opponentBrought: state.opponentBrought,
        myLeads: state.myLeads,
        opponentLeads: state.opponentLeads,
        turns: state.turns.length > 0 ? state.turns : undefined,
        opponentName: state.opponentName || undefined,
        notes: state.notes || undefined,
      };

      try {
        const res = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error ?? "Failed to save match",
          );
        }

        const data = (await res.json()) as { match: { id: string } };
        store.reset();
        router.push(`/battles/${data.match.id}`);
      } catch (err) {
        setSaving(false);
        alert(
          err instanceof Error ? err.message : "Failed to save match",
        );
      }
    },
    [store, router],
  );

  const handleStartOver = useCallback(() => {
    store.reset();
    setStep("mode");
  }, [store]);

  // -------------------------------------------------------------------------
  // Step index for indicator
  // -------------------------------------------------------------------------
  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Battle</h1>
          <p className="mt-1 text-muted-foreground">
            Log a new match result step by step.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleStartOver}>
          Start Over
        </Button>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors ${
                i === currentIdx
                  ? "bg-accent text-white"
                  : i < currentIdx
                    ? "bg-accent/20 text-primary"
                    : "bg-border/30 text-muted-foreground"
              }`}
            >
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-1 h-px w-4 ${
                  i < currentIdx ? "bg-accent/40" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card>
        <CardContent>
          {/* Step 1: Mode selection */}
          {step === "mode" && <NewBattleDialog onSelect={handleModeSelect} />}

          {/* Step 2: Select my team */}
          {step === "myTeam" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Select Your Team
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose which team you used for this battle.
                </p>
              </div>

              {teamsLoading && (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm text-muted-foreground">
                    Loading teams...
                  </span>
                </div>
              )}

              {!teamsLoading && teams.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No teams found. Create a team first in the Team Builder.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push("/teams")}
                  >
                    Go to Teams
                  </Button>
                </div>
              )}

              {!teamsLoading && teams.length > 0 && (
                <div className="grid gap-3">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => handleTeamSelect(team)}
                      className="cursor-pointer text-left w-full"
                    >
                      <Card className="transition-all hover:border-primary/50 hover:bg-border/10">
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground">
                                  {team.name}
                                </h3>
                                {team.isActive === 1 && (
                                  <Badge
                                    variant="success"
                                    className="text-[10px]"
                                  >
                                    Active
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {team.pokemon.map((mon, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
                                  >
                                    {mon.species}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-muted-foreground shrink-0"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Enter opponent team */}
          {step === "oppTeam" && (
            <OpponentTeamEntry onComplete={handleOpponentComplete} />
          )}

          {/* Step 4: Team Preview */}
          {step === "preview" && (
            <TeamPreview
              myTeam={store.myTeam}
              opponentTeam={store.opponentTeam}
              onComplete={handlePreviewComplete}
            />
          )}

          {/* Step 5: Battle logging (realtime / postmatch) */}
          {step === "battle" && store.mode === "realtime" && (
            <BattleLogger onEndBattle={handleEndBattle} />
          )}
          {step === "battle" && store.mode === "postmatch" && (
            <PostMatchEditor onEndBattle={handleEndBattle} />
          )}

          {/* Step 6: Record result */}
          {step === "result" && (
            <BattleResult
              opponentName={store.opponentName}
              notes={store.notes}
              onOpponentNameChange={store.setOpponentName}
              onNotesChange={store.setNotes}
              onSave={handleSave}
              saving={saving}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
