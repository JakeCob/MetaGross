"use client";

import { useState, useCallback, useRef } from "react";
import { TeamBuilder } from "./TeamBuilder";
import { AgentPanel } from "@/components/agent";
import type {
  PokemonBlock,
  ResearchTeamBlock,
} from "@/components/agent/PokemonCardRenderer";
import type { StarterSuggestion } from "@/components/agent/AgentMessageList";
import { Button } from "@/components/ui/button";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import type { MetaTeamPokemon } from "@/lib/meta-teams/types";

/**
 * Discovery chips for the team-builder agent empty state.
 * Mirrors the opening questions Claude asked Jacob during his
 * teambuilding session: goal → playstyle → underrepresented gap →
 * research anchor. Tapping a chip sends the prompt verbatim so the
 * agent can kick off the discovery workflow.
 */
const TEAM_STARTER_SUGGESTIONS: StarterSuggestion[] = [
  {
    label: "🎯 Build me a meta-counter team",
    prompt:
      "I want a team specifically built to counter the current Champions Reg M-A meta. Pull the latest Pikalytics + Limitless usage, show me the top 5 threats, then propose 2-3 distinct counter archetypes I can pick from.",
  },
  {
    label: "🧪 Propose 3 archetypes for my playstyle",
    prompt:
      "Before you suggest a team, ask me about my playstyle (offensive / balance / stall / disruption), my goal (meta counter / improve existing / new build), and what's underrepresented in my current teams. Then propose 3 distinct archetypes with a one-line rationale each.",
  },
  {
    label: "🏆 Show me recent tournament-winning teams",
    prompt:
      "What teams are winning Champions Reg M-A tournaments right now? List 5 teams with player, placement, and the 6-Pokemon roster. Pick whichever research tools give the most grounded answer — prefer our meta-team pool for speed.",
  },
  {
    label: "⭐ What is Wolfe Glick / other top players running?",
    prompt:
      "Research what Wolfe Glick and other top-ranked Reg M-A players are currently running. For each player, cite the team with source (tournament placement or verified team reveal) and summarise the core tech that makes it work. Pick whichever research tools give the most grounded answer.",
  },
  {
    label: "🔁 Build my own version of a tournament team",
    prompt:
      "I want to build my own version of a winning tournament team. First find 2-3 candidate reference teams from our research tools. Identify the core lever (the tech that makes it work). Then propose a variant that keeps the core and swaps non-core slots for Pokemon I'll be comfortable with. Explicitly list what you kept vs changed.",
  },
  {
    label: "📊 What's underrepresented in my current teams?",
    prompt:
      "Look at my saved teams (via get_team or list my existing ones) and tell me what archetype or playstyle is underrepresented. Then suggest a new team that fills the gap without overlapping my existing rotation.",
  },
];

interface TeamBuilderWithAgentProps {
  teamId?: string;
  initialSpecies?: string[];
  initialName?: string;
}

/**
 * Convert a MetaTeamPokemon (as returned by /api/meta-teams/match) into
 * the Partial<TeamPokemon> shape the TeamBuilder expects. Handles the
 * "Mega prefix → base species" normalisation so the sprite + form fields
 * stay consistent with how the rest of the app stores Megas.
 */
function metaTeamPokemonToTeamPokemon(
  mon: MetaTeamPokemon,
): Partial<TeamPokemon> {
  const rawMoves = Array.isArray(mon.moves) ? mon.moves : [];
  const moves: [string, string, string, string] = ["", "", "", ""];
  for (let i = 0; i < Math.min(4, rawMoves.length); i++) {
    moves[i] = (rawMoves[i] ?? "").trim();
  }

  const species = mon.species
    .replace(/^Mega\s+/, "")
    .replace(/\s*\(Mega\)/, "")
    .trim();

  return {
    species,
    ability: mon.ability ?? "",
    item: mon.item ?? "",
    nature: mon.nature ?? "Hardy",
    level: 50,
    teraType: mon.teraType ?? undefined,
    moves,
    evs: { ...DEFAULT_EVS },
    ivs: { ...DEFAULT_IVS },
  };
}

/** Build the "Make my version of X" prompt sent back through the agent. */
function buildVariantPrompt(data: ResearchTeamBlock): string {
  const team = data.team?.join(" / ") ?? "";
  const who = data.subtitle ? `${data.name} (${data.subtitle})` : data.name;
  return [
    `I want to build my own version of ${who}.`,
    team ? `Reference team: ${team}.` : null,
    data.coreTech ? `Core tech: ${data.coreTech}` : null,
    "",
    "Workflow:",
    "1. Call search_meta_teams mode=byAuthor or mode=match to pull the original full decklist (abilities, items, moves, nature). Cite it.",
    "2. Identify the CORE LEVER — the single ability / tech / item that makes it work.",
    "3. Propose a variant: KEEP the core lever, SWAP the 2-3 non-core slots for Pokemon I'm more comfortable with (or stronger into my usual matchups).",
    "4. EXPLICITLY list what you kept vs changed, and the rationale for each swap.",
    "5. Emit the full build card for every slot (### Pokemon / Ability / Item / Moves / Nature / Points / Spread Reasoning) so I can add them straight into the TeamBuilder.",
  ]
    .filter(Boolean)
    .join("\n");
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
  // Ref for the AgentPanel's sendMessage — set via callback so we can
  // trigger follow-up prompts (e.g. "Make my version of X") from a
  // ResearchTeamCard button.
  const sendMessageRef = useRef<((m: string) => void) | null>(null);

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

  /**
   * Fetch the full meta-team decklist for a given species list and
   * push every Pokemon into the current TeamBuilder. Uses the
   * existing /api/meta-teams/match endpoint — whichever pool row has
   * the highest overlap + trust wins.
   */
  const applyResearchTeamToBuilder = useCallback(
    async (data: ResearchTeamBlock): Promise<boolean> => {
      if (!addToTeamRef.current) return false;
      const species = data.team ?? [];
      if (species.length === 0) return false;

      try {
        const res = await fetch("/api/meta-teams/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            species,
            minOverlap: species.length,
            limit: 1,
          }),
        });
        if (!res.ok) throw new Error(`match HTTP ${res.status}`);
        const payload = (await res.json()) as {
          matches?: Array<{
            pokemon?: MetaTeamPokemon[];
            species?: string[];
          }>;
        };
        const full = payload.matches?.[0]?.pokemon ?? [];
        if (full.length === 0) {
          // Fall back to bare species entries.
          for (const sp of species) {
            addToTeamRef.current({
              species: sp
                .replace(/^Mega\s+/, "")
                .replace(/\s*\(Mega\)/, "")
                .trim(),
              ability: "",
              item: "",
              nature: "Hardy",
              level: 50,
              moves: ["", "", "", ""],
              evs: { ...DEFAULT_EVS },
              ivs: { ...DEFAULT_IVS },
            });
          }
          return true;
        }
        for (const mon of full) {
          addToTeamRef.current(metaTeamPokemonToTeamPokemon(mon));
        }
        return true;
      } catch (err) {
        console.error("[TeamBuilderWithAgent] apply research team failed", err);
        return false;
      }
    },
    [],
  );

  const handleUseResearchTeam = useCallback(
    (data: ResearchTeamBlock) => {
      // Fire-and-forget — errors are logged inside.
      void applyResearchTeamToBuilder(data);
    },
    [applyResearchTeamToBuilder],
  );

  const handleMakeVariant = useCallback(
    (data: ResearchTeamBlock) => {
      if (!sendMessageRef.current) return;
      sendMessageRef.current(buildVariantPrompt(data));
    },
    [],
  );

  const handleUseAllResearchTeams = useCallback(
    async (teams: ResearchTeamBlock[]) => {
      if (teams.length === 0) return;
      const [first, ...rest] = teams;
      const ok = await applyResearchTeamToBuilder(first);
      if (!ok) return;

      if (rest.length === 0) return;
      // Save the rest as draft teams.
      try {
        const res = await fetch("/api/teams/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drafts: rest.map((d) => ({
              name: d.subtitle
                ? `[Draft] ${d.name} — ${d.subtitle}`
                : `[Draft] ${d.name}`,
              archetype: d.subtitle ?? null,
              description: d.coreTech ?? null,
              sourceUrl: d.url ?? null,
              species: d.team ?? [],
            })),
          }),
        });
        if (!res.ok) {
          console.error("[TeamBuilderWithAgent] draft save HTTP", res.status);
        }
      } catch (err) {
        console.error("[TeamBuilderWithAgent] draft save failed", err);
      }
    },
    [applyResearchTeamToBuilder],
  );

  return (
    <>
      {/* Desktop: side-by-side layout */}
      <div className="hidden lg:grid lg:grid-cols-[2fr_1fr] lg:gap-6">
        <TeamBuilder teamId={teamId} initialSpecies={initialSpecies} initialName={initialName} onAddFromAgent={(fn) => { addToTeamRef.current = fn; }} />
        <div className="sticky top-4 h-[calc(100vh-6rem)]">
          <AgentPanel
            contextType="team"
            contextId={teamId}
            starterSuggestions={TEAM_STARTER_SUGGESTIONS}
            onSendMessageRef={(fn) => { sendMessageRef.current = fn; }}
            cardActions={{
              onAddToTeam: handleAddToTeam,
              onAddAllToTeam: handleAddAllToTeam,
              onUseResearchTeam: handleUseResearchTeam,
              onMakeVariant: handleMakeVariant,
              onUseAllResearchTeams: handleUseAllResearchTeams,
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
                starterSuggestions={TEAM_STARTER_SUGGESTIONS}
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
