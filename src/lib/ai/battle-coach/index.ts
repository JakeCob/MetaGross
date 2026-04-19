/**
 * Battle Coach — live turn advice.
 *
 * Single-LLM call, no tools, no graph. Structured JSON output that
 * drives the "This turn" section of the AI Coach panel.
 */
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import type { ActivePokemon, FieldState, Turn } from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { ScoutingResult, PredictedSet } from "@/lib/ai/opponent-scouting/types";
import type { TurnAdvice, TurnActionAdvice } from "./types";

export interface CoachInput {
  turnNumber: number;
  activeP1: ActivePokemon[];
  activeP2: ActivePokemon[];
  fieldState: FieldState;
  myTeam: TeamPokemon[];
  myBrought: string[];
  opponentTeam: Partial<TeamPokemon>[];
  opponentBrought: string[];
  faintedP1: string[];
  faintedP2: string[];
  recentTurns: Turn[];
  scouting: ScoutingResult | null;
  /** Optional user-selected LLM provider override. */
  provider?: string | null;
  /** Optional model name override for the selected provider. */
  modelName?: string | null;
}

const SYSTEM_PROMPT = `You are a high-level Pokemon VGC doubles coach (think Wolfe Glick / Cybertron level). You're advising the user IN-BATTLE, one turn at a time.

Respond with VALID JSON ONLY — no markdown, no code fences, no prose outside the object. Schema:

{
  "myActions": [
    {
      "species": "<my active Pokemon>",
      "recommendation": "<Click MoveName / Switch to X / Protect / etc.>",
      "reasoning": "<one sentence citing speed tiers, calcs, or matchup logic>",
      "target": "<opponent species when move is single-target, omit otherwise>"
    },
    ...up to 2 entries, one per live active slot
  ],
  "opponentPlan": "<what you think they'll click and why, 1-2 sentences>",
  "backupPlan": "<if they deviate, what the user should do instead — 1 sentence>",
  "winProbability": <integer 0-100>,
  "keyNote": "<OPTIONAL caution / key math / flinch odds / anything the user must not miss>",
  "commentary": "<OPTIONAL 2-3 sentence read of the board state>"
}

Rules:
- Consider Intimidate drops, burn, Fake Out flinches, priority moves, ability negation (Levitate / Armor Tail / Cloud Nine), terrain, weather, and speed tier.
- If the opponent is predicted to lead with Fake Out and a nuke, recommend spread moves / Protect / pivot rather than single-target attacks on the Fake Out user.
- Prefer named moves the Pokemon actually has on its revealed set, or if unknown, cite common sets.
- Never recommend a move that would hit your own ally (Earthquake hits both, Rock Slide hits only foes — mention this if relevant).
- When the user has a burn / status stuck on an opponent, factor it into the win probability.
- Keep recommendations concrete: "Click Snarl" not "use a Dark move". Cite the target when single-target.`;

export async function getTurnAdvice(input: CoachInput): Promise<TurnAdvice> {
  const provider = (input.provider as "openai" | "openrouter" | "anthropic" | null) || detectProvider();
  const model = createModel(provider, input.modelName ?? undefined);

  const userPrompt = buildUserPrompt(input);
  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(userPrompt),
  ]);

  const text = flattenContent(response.content);
  const parsed = parseJsonLoose(text);

  return {
    turnNumber: input.turnNumber,
    myActions: Array.isArray(parsed?.myActions)
      ? (parsed.myActions as TurnActionAdvice[]).slice(0, 2)
      : [],
    opponentPlan: typeof parsed?.opponentPlan === "string" ? parsed.opponentPlan : "",
    backupPlan: typeof parsed?.backupPlan === "string" ? parsed.backupPlan : "",
    winProbability:
      typeof parsed?.winProbability === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.winProbability)))
        : 50,
    keyNote: typeof parsed?.keyNote === "string" ? parsed.keyNote : undefined,
    commentary: typeof parsed?.commentary === "string" ? parsed.commentary : undefined,
    generatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is { type: "text"; text: string } =>
          typeof b === "object" && b !== null && "type" in b && (b as { type: string }).type === "text" && "text" in b,
      )
      .map((b) => b.text)
      .join("");
  }
  return "";
}

/** Strip markdown code fences + extract the first {...} block. */
function parseJsonLoose(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const first = withoutFence.indexOf("{");
  const last = withoutFence.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  try {
    return JSON.parse(withoutFence.slice(first, last + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fmtActive(side: "p1" | "p2", list: ActivePokemon[]): string {
  return list
    .map((p, i) => {
      const parts = [
        `${side} slot ${i + 1}: ${p.species}`,
        `${p.hpPercent}%`,
      ];
      if (p.isMega) parts.push("MEGA");
      if (p.status) parts.push(p.status.toUpperCase());
      if (p.itemRemoved) parts.push("item knocked off");
      const boostEntries = Object.entries(p.boosts).filter(([, v]) => v !== 0);
      if (boostEntries.length > 0) {
        parts.push(
          `boosts: ${boostEntries.map(([k, v]) => `${k}${v > 0 ? "+" : ""}${v}`).join(", ")}`,
        );
      }
      if (p.disguisedAs) parts.push(`(was disguised as ${p.disguisedAs})`);
      return parts.join(" | ");
    })
    .join("\n  ");
}

function fmtField(f: FieldState): string {
  const parts: string[] = [];
  if (f.weather) parts.push(`weather=${f.weather}`);
  if (f.terrain) parts.push(`terrain=${f.terrain}`);
  if (f.trickRoom) parts.push("Trick Room");
  if (f.tailwindP1) parts.push("TW on my side");
  if (f.tailwindP2) parts.push("TW on opp side");
  return parts.length > 0 ? parts.join(", ") : "clear";
}

function fmtMyTeam(myTeam: TeamPokemon[], brought: string[]): string {
  const brSet = new Set(brought);
  return myTeam
    .map((p) => {
      const moves = p.moves.filter(Boolean).join("/");
      const tag = brSet.has(p.species) ? "★" : " ";
      return `  ${tag} ${p.species} | ${p.ability || "?"} | ${p.item || "?"} | ${p.nature} | ${moves}`;
    })
    .join("\n");
}

function fmtPredictions(preds: PredictedSet[]): string {
  if (preds.length === 0) return "(no scouting predictions)";
  return preds
    .map((p) => {
      const moves = p.moves.filter(Boolean).join("/");
      const conf = Math.round(p.confidence * 100);
      return `  • ${p.species} (${conf}% conf) | ${p.ability || "?"} | ${p.item || "?"} | ${p.nature} | ${moves}`;
    })
    .join("\n");
}

function fmtRecentTurns(turns: Turn[]): string {
  if (turns.length === 0) return "(first turn — no history)";
  const lastFew = turns.slice(-3);
  return lastFew
    .map((t) => {
      const actions = t.actions
        .map((a) => {
          const who = `${a.side}:${a.slot}`;
          if (a.actionType === "move" || a.actionType === "mega_move") {
            const target = a.targetSide && a.targetSlot ? ` → ${a.targetSide}:${a.targetSlot}` : "";
            const dmg = a.damageDealtPercent != null ? ` (${a.damageDealtPercent}%)` : "";
            const flags: string[] = [];
            if (a.wasKo) flags.push("KO");
            if (a.wasCriticalHit) flags.push("CRIT");
            if (a.wasMiss) flags.push("MISSED");
            if (a.causedFlinch) flags.push("flinch");
            if (a.inflictedStatus) flags.push(a.inflictedStatus);
            if (a.removedItem) flags.push("KNOCKED OFF");
            if (a.megaEvolved) flags.push("MEGA");
            const suffix = flags.length > 0 ? ` [${flags.join(",")}]` : "";
            return `${who} ${a.moveName}${target}${dmg}${suffix}`;
          }
          if (a.actionType === "switch") {
            return `${who} switch ${a.switchOutSpecies} → ${a.switchInSpecies}`;
          }
          return `${who} ${a.actionType}`;
        })
        .join("; ");
      return `  T${t.number}: ${actions}`;
    })
    .join("\n");
}

function buildUserPrompt(input: CoachInput): string {
  const {
    turnNumber,
    activeP1,
    activeP2,
    fieldState,
    myTeam,
    myBrought,
    opponentTeam,
    faintedP1,
    faintedP2,
    recentTurns,
    scouting,
  } = input;

  const oppPredictions = scouting?.predictedSets ?? [];
  const archetype = scouting?.archetype ?? "unknown";
  const watchFor = scouting?.watchFor ?? [];

  return `TURN ${turnNumber}

FIELD: ${fmtField(fieldState)}

MY SIDE:
  ${fmtActive("p1", activeP1)}

OPPONENT SIDE:
  ${fmtActive("p2", activeP2)}

Fainted: my=[${faintedP1.join(", ") || "none"}] | opp=[${faintedP2.join(", ") || "none"}]

MY TEAM (★ = brought):
${fmtMyTeam(myTeam, myBrought)}

OPPONENT (revealed 6):
${opponentTeam.map((p) => `  • ${p.species ?? "?"} | ability=${p.ability || "?"} | item=${p.item || "?"}`).join("\n")}

OPPONENT PREDICTED SETS (from scouting):
${fmtPredictions(oppPredictions)}

ARCHETYPE: ${archetype}
WATCH FOR: ${watchFor.length > 0 ? watchFor.map((w) => `• ${w}`).join(" ") : "(none recorded)"}

RECENT TURNS:
${fmtRecentTurns(recentTurns)}

Based on this exact board state, what should I do this turn? Respond with the JSON schema from the system message only.`;
}
