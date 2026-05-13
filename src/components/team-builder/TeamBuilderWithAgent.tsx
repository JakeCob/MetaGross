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
import { BotIcon, XIcon } from "lucide-react";
import type { TeamPokemon } from "@/lib/types/pokemon";
import { DEFAULT_EVS, DEFAULT_IVS } from "@/lib/types/pokemon";
import type { MetaTeamPokemon } from "@/lib/meta-teams/types";
import {
  applyPokemonPatchToTeam,
  type PokemonPatchPayload,
} from "@/lib/ai/graph/team-patch";

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

function hasSpecies(
  pokemon: Partial<TeamPokemon>,
): pokemon is Partial<TeamPokemon> & { species: string } {
  return (pokemon.species ?? "").trim().length > 0;
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

/**
 * Strip the agent's trailing "value — rationale" annotation before we
 * write it into a saved TeamPokemon. The card renderer does the same
 * thing upstream; this is a belt-and-braces guard for edge cases (pastes,
 * old cached blocks, etc.).
 */
function cleanBuildValue(raw: string | undefined): string {
  if (!raw) return "";
  let v = raw.trim();
  const dashMatch = v.match(/\s+[—–-]\s+/);
  if (dashMatch && dashMatch.index !== undefined) {
    v = v.slice(0, dashMatch.index).trim();
  }
  const parenIdx = v.indexOf(" (");
  if (parenIdx > 0) v = v.slice(0, parenIdx).trim();
  return v.replace(/^\*+|\*+$/g, "").trim();
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
    ability: cleanBuildValue(block.ability),
    item: cleanBuildValue(block.item),
    nature: cleanBuildValue(block.nature) || "Hardy",
    level: 50,
    moves,
    evs,
    ivs: { ...DEFAULT_IVS },
  };
}

// ResearchTeamBlock → draft payload, with all the sanitisation the
// server expects: empty/whitespace species dropped, name capped at
// 120 chars, sourceUrl set to null unless it's a real URL.
function buildDraftPayload(block: ResearchTeamBlock): {
  name: string;
  archetype: string | null;
  description: string | null;
  sourceUrl: string | null;
  species: string[];
} | null {
  const species = (block.team ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 6); // server caps at 6
  if (species.length === 0) return null;

  const rawName = block.subtitle
    ? `[Draft] ${block.name} — ${block.subtitle}`
    : `[Draft] ${block.name}`;
  const name = rawName.trim().slice(0, 120) || "[Draft]";

  let sourceUrl: string | null = null;
  const candidate = (block.url ?? "").trim();
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        sourceUrl = parsed.toString();
      }
    } catch {
      // not a URL — leave sourceUrl null. The server's Zod schema
      // would 400 the whole batch on a non-URL string.
    }
  }

  return {
    name,
    archetype: block.subtitle?.trim() ? block.subtitle.trim() : null,
    description: block.coreTech?.trim() ? block.coreTech.trim() : null,
    sourceUrl,
    species,
  };
}

export function TeamBuilderWithAgent({
  teamId,
  initialSpecies,
  initialName,
}: TeamBuilderWithAgentProps) {
  const [agentOpen, setAgentOpen] = useState(false);
  // Lightweight banner so success/failure of background actions like
  // "Use first, save rest as drafts" isn't invisible — the old
  // implementation only console.error'd, so the user just saw nothing
  // happen and assumed the button was broken.
  const [actionNotice, setActionNotice] = useState<{
    kind: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const flashNotice = useCallback(
    (kind: "info" | "success" | "error", message: string) => {
      setActionNotice({ kind, message });
      window.setTimeout(() => setActionNotice(null), 6000);
    },
    [],
  );
  // Ref for TeamBuilder's add function — set via callback
  const addToTeamRef = useRef<((pokemon: Partial<TeamPokemon>) => void) | null>(null);
  // Ref for TeamBuilder's bulk-replace function. "+ Add All N to Team"
  // needs this because onAddFromAgent only fills empty slots — once
  // the builder has 6 filled slots from a previous suggestion, the
  // per-Pokemon adds silently no-op.
  const replaceTeamRef = useRef<
    ((pokemon: Partial<TeamPokemon>[]) => void) | null
  >(null);
  // Ref for the AgentPanel's sendMessage — set via callback so we can
  // trigger follow-up prompts (e.g. "Make my version of X") from a
  // ResearchTeamCard button.
  const sendMessageRef = useRef<((m: string) => void) | null>(null);
  // Getter that returns the current draft team from TeamBuilder. The
  // AgentPanel calls this before every POST so the agent gets the live
  // team state (not just the saved one) and can propose patches to
  // the team the user is actively building.
  const currentTeamGetterRef = useRef<
    (() => { name: string; format: string; pokemon: Partial<TeamPokemon>[] }) | null
  >(null);

  const handleAddToTeam = useCallback((block: PokemonBlock) => {
    if (!addToTeamRef.current) {
      console.warn(
        "[TeamBuilderWithAgent] addToTeamRef not wired — TeamBuilder didn't register its onAddFromAgent callback yet.",
      );
      return;
    }
    const teamPokemon = pokemonBlockToTeamPokemon(block);
    addToTeamRef.current(teamPokemon);
  }, []);

  const handleAddAllToTeam = useCallback((blocks: PokemonBlock[]) => {
    const team = blocks.map(pokemonBlockToTeamPokemon);
    // Prefer the bulk-replace path. It wipes the 6 slots so a user
    // whose builder is already full doesn't end up with the adds
    // silently dropped.
    if (replaceTeamRef.current) {
      replaceTeamRef.current(team);
      return;
    }
    if (!addToTeamRef.current) {
      console.warn(
        "[TeamBuilderWithAgent] addToTeamRef not wired — cannot add all.",
      );
      return;
    }
    for (const teamPokemon of team) {
      addToTeamRef.current(teamPokemon);
    }
  }, []);

  const handleApplyDraftPatch = useCallback((payload: PokemonPatchPayload) => {
    const snapshot = currentTeamGetterRef.current
      ? currentTeamGetterRef.current()
      : null;
    if (!snapshot || !replaceTeamRef.current) return;

    const filledPokemon = snapshot.pokemon.filter(hasSpecies);
    if (filledPokemon.length === 0) return;

    try {
      const patched = applyPokemonPatchToTeam(filledPokemon, payload);
      replaceTeamRef.current(patched);
    } catch (err) {
      console.error("[TeamBuilderWithAgent] apply draft patch failed", err);
    }
  }, []);

  const handleSaveResearchTeamAsDraft = useCallback(
    async (data: ResearchTeamBlock) => {
      const draft = buildDraftPayload(data);
      if (!draft) {
        flashNotice("error", `Couldn't save "${data.name}" — no species found.`);
        return;
      }
      try {
        const res = await fetch("/api/teams/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drafts: [draft] }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          flashNotice(
            "error",
            `Couldn't save draft: HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}`,
          );
          return;
        }
        flashNotice("success", `Saved "${data.name}" as a draft.`);
      } catch (err) {
        flashNotice(
          "error",
          `Couldn't save draft: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [flashNotice],
  );

  const handleOpenResearchTeamInNewTab = useCallback(
    (data: ResearchTeamBlock) => {
      const species = data.team ?? [];
      if (species.length === 0) return;
      // /teams/new reads `core` (comma-separated species) and `name`.
      const params = new URLSearchParams();
      params.set("core", species.join(","));
      const suggestedName = data.subtitle
        ? `${data.name} — ${data.subtitle}`
        : data.name;
      if (suggestedName) params.set("name", suggestedName);
      window.open(
        `/teams/new?${params.toString()}`,
        "_blank",
        "noopener,noreferrer",
      );
    },
    [],
  );

  /**
   * Fetch the full meta-team decklist for a given species list and
   * push every Pokemon into the current TeamBuilder. Uses the
   * existing /api/meta-teams/match endpoint — whichever pool row has
   * the highest overlap + trust wins.
   */
  const applyResearchTeamToBuilder = useCallback(
    async (data: ResearchTeamBlock): Promise<boolean> => {
      const species = data.team ?? [];
      if (species.length === 0) return false;
      if (!replaceTeamRef.current && !addToTeamRef.current) return false;

      const bareFallback = (): Partial<TeamPokemon>[] =>
        species.map((sp) => ({
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
        }));

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
        const team: Partial<TeamPokemon>[] =
          full.length === 0
            ? bareFallback()
            : full.map(metaTeamPokemonToTeamPokemon);

        if (replaceTeamRef.current) {
          replaceTeamRef.current(team);
        } else if (addToTeamRef.current) {
          for (const mon of team) addToTeamRef.current(mon);
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

      // Apply the first AND save the rest in parallel — they're
      // independent operations, so don't gate one on the other. The
      // old code returned early when the apply failed, swallowing the
      // user's "save these for later" intent silently.
      const drafts = rest
        .map(buildDraftPayload)
        .filter((d): d is NonNullable<typeof d> => d !== null);
      const skipped = rest.length - drafts.length;

      const [applyOk, draftResult] = await Promise.all([
        applyResearchTeamToBuilder(first),
        drafts.length === 0
          ? Promise.resolve<{ ok: true; count: 0 } | { ok: false; err: string }>(
              { ok: true, count: 0 },
            )
          : (async () => {
              try {
                const res = await fetch("/api/teams/draft", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ drafts }),
                });
                if (!res.ok) {
                  const body = await res.text().catch(() => "");
                  return {
                    ok: false as const,
                    err: `HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
                  };
                }
                const payload = (await res.json().catch(() => null)) as
                  | { count?: number }
                  | null;
                return { ok: true as const, count: payload?.count ?? drafts.length };
              } catch (err) {
                return {
                  ok: false as const,
                  err: err instanceof Error ? err.message : String(err),
                };
              }
            })(),
      ]);

      const draftCount = draftResult.ok ? draftResult.count : 0;
      const parts: string[] = [];
      if (applyOk) parts.push(`Loaded "${first.name}" into the builder`);
      else parts.push(`Couldn't load "${first.name}" into the builder`);
      if (draftCount > 0) parts.push(`saved ${draftCount} as drafts`);
      if (skipped > 0) parts.push(`skipped ${skipped} (no species)`);
      if (!draftResult.ok)
        parts.push(`draft save failed: ${draftResult.err}`);

      const kind = applyOk && draftResult.ok ? "success" : "error";
      flashNotice(kind, parts.join(" · "));

      if (!draftResult.ok) {
        console.error(
          "[TeamBuilderWithAgent] draft save failed",
          draftResult.err,
        );
      }
    },
    [applyResearchTeamToBuilder, flashNotice],
  );

  const cardActions = {
    onAddToTeam: handleAddToTeam,
    onAddAllToTeam: handleAddAllToTeam,
    onUseResearchTeam: handleUseResearchTeam,
    onMakeVariant: handleMakeVariant,
    onUseAllResearchTeams: handleUseAllResearchTeams,
    onSaveResearchTeamAsDraft: handleSaveResearchTeamAsDraft,
    onOpenResearchTeamInNewTab: handleOpenResearchTeamInNewTab,
  };

  // One TeamBuilder, one AgentPanel — layout is CSS-only. Previously
  // we rendered separate desktop + mobile TeamBuilders (hidden via
  // Tailwind breakpoints) which caused a ref-race: both instances
  // mounted, both registered their add/replace fns against the same
  // parent ref, and whichever ran its effect last "won". State updates
  // from "+ Add All 6" often landed in the hidden instance, making the
  // button look broken.
  return (
    <>
      {actionNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-3 rounded-md border px-3 py-2 text-sm ${
            actionNotice.kind === "success"
              ? "border-emerald-700 bg-emerald-950/40 text-emerald-100"
              : actionNotice.kind === "error"
                ? "border-destructive/60 bg-destructive/10 text-destructive-foreground"
                : "border-border bg-card text-muted-foreground"
          }`}
        >
          {actionNotice.message}
        </div>
      )}
      {/* Responsive grid — 1 column on small screens, 2fr|1fr on lg+. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
        <TeamBuilder
          teamId={teamId}
          initialSpecies={initialSpecies}
          initialName={initialName}
          onAddFromAgent={(fn) => {
            addToTeamRef.current = fn;
          }}
          onReplaceFromAgent={(fn) => {
            replaceTeamRef.current = fn;
          }}
          onCurrentTeamRef={(fn) => {
            currentTeamGetterRef.current = fn;
          }}
        />

        {/* Side panel: AgentPanel sticky on the right column at md+
            (covers most laptop split-screen widths). Below md the
            mobile FAB takes over. */}
        <div className="hidden md:block md:sticky md:top-4 md:h-[calc(100vh-6rem)]">
          <AgentPanel
            contextType="team"
            contextId={teamId}
            starterSuggestions={TEAM_STARTER_SUGGESTIONS}
            onSendMessageRef={(fn) => {
              sendMessageRef.current = fn;
            }}
            cardActions={cardActions}
            onApplyDraftPatch={handleApplyDraftPatch}
            getDraftTeam={() => {
              const snap = currentTeamGetterRef.current
                ? currentTeamGetterRef.current()
                : null;
              if (!snap) return null;
              return {
                name: snap.name,
                format: snap.format,
                pokemon: snap.pokemon.map((p) => ({
                  species: p.species,
                  ability: p.ability,
                  item: p.item,
                  nature: p.nature,
                  moves: Array.isArray(p.moves)
                    ? (p.moves as string[]).filter(Boolean)
                    : undefined,
                  evs: p.evs as Record<string, number> | undefined,
                  ivs: p.ivs as Record<string, number> | undefined,
                  level: p.level,
                  teraType: p.teraType,
                })),
              };
            }}
          />
        </div>
      </div>

      {/* Mobile (below md): labeled FAB + fixed bottom drawer. The
          desktop column is hidden, so AgentPanel only mounts here
          when the viewport is below the md breakpoint. */}
      <div className="md:hidden">
        {!agentOpen && (
          <div
            className="fixed right-4 z-50"
            style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <Button
              onClick={() => setAgentOpen(true)}
              aria-label="Open AI assistant"
              className="gap-2 rounded-full px-4 py-3 shadow-lg shadow-primary/30"
            >
              <BotIcon className="size-4" />
              <span className="text-sm font-medium">Ask AI</span>
            </Button>
          </div>
        )}

        {agentOpen && (
          <div
            // `dvh` (dynamic viewport height) accounts for the iOS
            // Safari URL bar collapsing/expanding — `vh` uses the
            // static viewport which includes the URL bar and pushes
            // our composer below the screen edge on iPhone SE. Using
            // 92dvh + small inner padding gives breathing room above
            // the home-indicator without burying the composer.
            className="fixed inset-x-0 bottom-0 z-50 h-[92dvh] bg-background border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
          >
            <div className="flex h-full min-h-0 flex-col gap-2 p-2 sm:p-3">
              <div className="flex h-9 shrink-0 items-center justify-between px-1">
                <span className="text-sm font-medium text-foreground">
                  AI team chat
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setAgentOpen(false)}
                  aria-label="Close AI assistant"
                  title="Close AI assistant"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <AgentPanel
                  contextType="team"
                  contextId={teamId}
                  starterSuggestions={TEAM_STARTER_SUGGESTIONS}
                  cardActions={cardActions}
                  onApplyDraftPatch={handleApplyDraftPatch}
                  getDraftTeam={() => {
                    const snap = currentTeamGetterRef.current
                      ? currentTeamGetterRef.current()
                      : null;
                    if (!snap) return null;
                    return {
                      name: snap.name,
                      format: snap.format,
                      pokemon: snap.pokemon.map((p) => ({
                        species: p.species,
                        ability: p.ability,
                        item: p.item,
                        nature: p.nature,
                        moves: Array.isArray(p.moves)
                          ? (p.moves as string[]).filter(Boolean)
                          : undefined,
                        evs: p.evs as Record<string, number> | undefined,
                        ivs: p.ivs as Record<string, number> | undefined,
                        level: p.level,
                        teraType: p.teraType,
                      })),
                    };
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
