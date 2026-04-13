"use client";

import { useState, useCallback, useRef } from "react";
import { TeamBuilder } from "./TeamBuilder";
import { AgentPanel } from "@/components/agent";
import type { PokemonBlock } from "@/components/agent/PokemonCardRenderer";
import { Button } from "@/components/ui/button";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";

interface TeamBuilderWithAgentProps {
  teamId?: string;
  initialSpecies?: string[];
  initialName?: string;
}

function pokemonBlockToTeamPokemon(block: PokemonBlock): Partial<TeamPokemon> {
  // Parse points string "HP 32 / Atk 0 / Def 4 / SpA 24 / SpD 8 / Spe 18"
  const evs = { ...DEFAULT_EVS };
  if (block.points) {
    const pointMatch = block.points.matchAll(/(?:HP|Atk|Def|SpA|SpD|Spe)\s*(\d+)/g);
    const vals = [...pointMatch].map((m) => parseInt(m[1]));
    if (vals.length === 6) {
      evs.hp = vals[0];
      evs.atk = vals[1];
      evs.def = vals[2];
      evs.spa = vals[3];
      evs.spd = vals[4];
      evs.spe = vals[5];
    }
  }

  const moves: [string, string, string, string] = ["", "", "", ""];
  if (block.moves) {
    block.moves.split(/\s*\/\s*/).forEach((m, i) => {
      if (i < 4) moves[i] = m.trim();
    });
  }

  // Clean species name (remove "Mega" prefix for the base species)
  const species = block.name
    .replace(/^Mega\s+/, "")
    .replace(/\s*\(Mega\)/, "")
    .trim();

  return {
    species,
    ability: block.ability || "",
    item: block.item || "",
    nature: block.nature || "Hardy",
    level: 50,
    moves,
    evs,
    ivs: { ...DEFAULT_IVS },
  };
}

export function TeamBuilderWithAgent({
  teamId,
  initialSpecies,
  initialName,
}: TeamBuilderWithAgentProps) {
  const [agentOpen, setAgentOpen] = useState(false);
  // Ref for TeamBuilder's add function — set via callback
  const addToTeamRef = useRef<((pokemon: Partial<TeamPokemon>) => void) | null>(null);

  const handleAddToTeam = useCallback((block: PokemonBlock) => {
    const teamPokemon = pokemonBlockToTeamPokemon(block);
    if (addToTeamRef.current) {
      addToTeamRef.current(teamPokemon);
    }
  }, []);

  const handleAddAllToTeam = useCallback((blocks: PokemonBlock[]) => {
    if (!addToTeamRef.current) return;
    for (const block of blocks) {
      const teamPokemon = pokemonBlockToTeamPokemon(block);
      addToTeamRef.current(teamPokemon);
    }
  }, []);

  return (
    <>
      {/* Desktop: side-by-side layout */}
      <div className="hidden lg:grid lg:grid-cols-[2fr_1fr] lg:gap-6">
        <TeamBuilder teamId={teamId} initialSpecies={initialSpecies} initialName={initialName} onAddFromAgent={(fn) => { addToTeamRef.current = fn; }} />
        <div className="sticky top-4 h-[calc(100vh-6rem)]">
          <AgentPanel
            contextType="team"
            contextId={teamId}
            cardActions={{
              onAddToTeam: handleAddToTeam,
              onAddAllToTeam: handleAddAllToTeam,
            }}
          />
        </div>
      </div>

      {/* Mobile/tablet: stacked with collapsible agent */}
      <div className="lg:hidden">
        <TeamBuilder teamId={teamId} initialSpecies={initialSpecies} initialName={initialName} onAddFromAgent={(fn) => { addToTeamRef.current = fn; }} />

        <div className="fixed bottom-4 right-4 z-40">
          <Button
            size="icon-lg"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setAgentOpen((o) => !o)}
            aria-label={agentOpen ? "Close AI assistant" : "Open AI assistant"}
          >
            {agentOpen ? "✕" : "🤖"}
          </Button>
        </div>

        {agentOpen && (
          <div className="fixed inset-x-0 bottom-0 z-30 h-[60vh] bg-background border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="h-full p-3">
              <AgentPanel
                contextType="team"
                contextId={teamId}
                cardActions={{
                  onAddToTeam: handleAddToTeam,
                  onAddAllToTeam: handleAddAllToTeam,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
