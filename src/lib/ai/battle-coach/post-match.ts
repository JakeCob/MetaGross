/**
 * Post-match analysis — two markdown documents.
 *
 *   opponentTeamMd: reconstructed sets per Pokemon the user faced,
 *                   distinguishing "known" from "predicted" per field.
 *   battleLogMd:    strategy breakdown + turning points + mistakes +
 *                   improvements + final takeaways, shaped after the
 *                   Gemini sample the user shared.
 *
 * Two sequential LLM calls, structured markdown output directly (no
 * JSON parsing — we want natural prose with emoji headers).
 */
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import type {
  BattleMode,
  BattleResult,
  Turn,
  ActivePokemon,
  FieldState,
} from "@/lib/types/battle";
import type { TeamPokemon } from "@/lib/types/pokemon";
import type { ScoutingResult } from "@/lib/ai/opponent-scouting/types";

export interface PostMatchInput {
  /** Match metadata */
  result: BattleResult;
  mode: BattleMode;
  format: string;
  opponentName: string;
  notes: string;
  /** Teams */
  myTeam: TeamPokemon[];
  opponentTeam: Partial<TeamPokemon>[];
  myBrought: string[];
  opponentBrought: string[];
  myLeads: string[];
  opponentLeads: string[];
  /** Turn history */
  turns: Turn[];
  faintedP1: string[];
  faintedP2: string[];
  finalFieldState?: FieldState;
  finalActiveP1?: ActivePokemon[];
  finalActiveP2?: ActivePokemon[];
  /** Pre-match intel */
  scouting: ScoutingResult | null;
  /** Optional team description/notes the user wrote in the team builder. */
  myTeamDescription?: string;
  /** Optional user-selected LLM provider override. */
  provider?: string | null;
  /** Optional model name override for the selected provider. */
  modelName?: string | null;
}

export interface PostMatchOutput {
  opponentTeamMd: string;
  battleLogMd: string;
  generatedAt: number;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function generatePostMatchAnalysis(
  input: PostMatchInput,
): Promise<PostMatchOutput> {
  const provider =
    (input.provider as "openai" | "openrouter" | "anthropic" | null) ||
    detectProvider();
  const model = createModel(provider, input.modelName ?? undefined);

  const [opponentTeamMd, battleLogMd] = await Promise.all([
    runOpponentTeamAnalysis(model, input),
    runBattleLogAnalysis(model, input),
  ]);

  return {
    opponentTeamMd: stripFences(opponentTeamMd),
    battleLogMd: stripFences(battleLogMd),
    generatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// LLM call: opponent team reconstruction
// ---------------------------------------------------------------------------

const OPP_TEAM_SYSTEM = `You are a VGC doubles analyst writing a post-match dossier of the opponent's team. The user just finished a logged battle — you have the revealed species, any ability/item reveals, and every move they used turn-by-turn.

Output: a single markdown document titled "# Opponent Team Analysis: <OpponentName>'s <Archetype>". For each of their 6 Pokemon, a section with:
  * Role (Disruptor, Bulky Nuke, Redirector, etc.)
  * **Known Item** or **Predicted Item** (depending on whether the match revealed it)
  * **Known Ability** / **Predicted Ability**
  * **Predicted EVs** (give a concrete 252/252/4 spread + Nature based on role + observed speed order + damage taken)
  * **Known Moves** (moves logged in the match) and **Predicted Moves** (to fill 4 slots)
  * 1-line rationale when a prediction is non-obvious

Use the 🐇 / 🕷️ / 🧚 / 🌋 / 🐺 / 🏄 style emoji headers per Pokemon — pick emoji that match the species' theme.

Output markdown only, no code fences, no preamble, no trailing "happy to generate …" message.`;

async function runOpponentTeamAnalysis(
  model: ReturnType<typeof createModel>,
  input: PostMatchInput,
): Promise<string> {
  const prompt = buildOpponentTeamPrompt(input);
  const response = await model.invoke([
    new SystemMessage(OPP_TEAM_SYSTEM),
    new HumanMessage(prompt),
  ]);
  return flattenContent(response.content);
}

function buildOpponentTeamPrompt(input: PostMatchInput): string {
  const {
    opponentName,
    format,
    opponentTeam,
    turns,
    scouting,
  } = input;

  // Collect all observed moves per opponent species from the turn log.
  const observedMoves: Record<string, Set<string>> = {};
  for (const t of turns) {
    for (const a of t.actions) {
      if (a.side !== "p2") continue;
      if (!a.moveName) continue;
      // Map slot back to species using the turn's activeP2 snapshot.
      const sp = t.activeP2[a.slot - 1]?.species;
      if (!sp) continue;
      observedMoves[sp] ??= new Set();
      observedMoves[sp].add(a.moveName);
    }
  }

  // Mega / disguise / item-remove observations per species.
  const observedFacts: Record<string, string[]> = {};
  for (const t of turns) {
    for (const p of t.activeP2) {
      if (p.isMega) {
        observedFacts[p.species] ??= [];
        if (!observedFacts[p.species].includes("Mega Evolved"))
          observedFacts[p.species].push("Mega Evolved");
      }
      if (p.status) {
        observedFacts[p.species] ??= [];
        const tag = `Took ${p.status}`;
        if (!observedFacts[p.species].includes(tag))
          observedFacts[p.species].push(tag);
      }
      if (p.disguisedAs) {
        observedFacts[p.species] ??= [];
        observedFacts[p.species].push(`Was disguised as ${p.disguisedAs} (Illusion/Imposter)`);
      }
    }
  }

  const lines: string[] = [];
  lines.push(`OPPONENT NAME: ${opponentName || "Unknown"}`);
  lines.push(`FORMAT: ${format}`);
  if (scouting?.archetype) lines.push(`SCOUTED ARCHETYPE: ${scouting.archetype}`);
  if (scouting?.teamSynergies.length) {
    lines.push(`SCOUTED SYNERGIES:`);
    scouting.teamSynergies.forEach((s) => lines.push(`  • ${s}`));
  }
  lines.push("");
  lines.push("OPPONENT TEAM (revealed 6 + observations):");
  for (const p of opponentTeam) {
    const sp = p.species ?? "?";
    lines.push(`  • ${sp}`);
    lines.push(`    - Known ability: ${p.ability || "(not revealed)"}`);
    lines.push(`    - Known item:    ${p.item || "(not revealed)"}`);
    const moves = observedMoves[sp] ? [...observedMoves[sp]].join(", ") : "(none used)";
    lines.push(`    - Observed moves: ${moves}`);
    const facts = observedFacts[sp];
    if (facts && facts.length > 0) {
      lines.push(`    - Battle observations: ${facts.join("; ")}`);
    }
    // Scouting prediction if we have one.
    const pred = scouting?.predictedSets?.find((s) => s.species === sp);
    if (pred) {
      lines.push(
        `    - Scouting prediction (conf ${Math.round(pred.confidence * 100)}%): ability=${pred.ability || "?"}, item=${pred.item || "?"}, nature=${pred.nature}, moves=${pred.moves.filter(Boolean).join("/") || "?"}`,
      );
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// LLM call: battle log analysis
// ---------------------------------------------------------------------------

const BATTLE_LOG_SYSTEM = `You are a VGC doubles coach writing a post-match breakdown for the player. You have every turn, every action, every reveal, plus the pre-match scouting output.

Output: a single markdown document titled "# Battle Log: <MyArchetype> vs. <OpponentName> (<OpponentArchetype>)" that contains:

## 🏆 Post-Match Analysis
A 1-paragraph header summary: result, what the match demonstrated.

### 🔍 The Opponent's Strategy
Characterize what the opponent tried to do. Call out each key Pokemon + their role in their plan.

### 🧠 Key Turning Points & Tactics
Number 2-4 pivotal moments in the match. For each: the turn, the choice made, why it mattered, and the mechanical effect. Cite specific moves, abilities, items, calcs, speed tiers. Bold key tactical names ("Speed Flip", "Meat Grinder", "Checkmate Pivot").

### ⚠️ Mistakes & Misplays
List 0-4 mistakes the user made or better plays that would have been available. Be honest but concise — one bullet per mistake. If the user played perfectly, write "No significant mistakes — this game was well-executed from lead to close."

### 💡 Improvements & Takeaways
Actionable 1-2 sentence suggestions for the NEXT battle. Not generic advice — things grounded in this specific match (EV tweaks, lead adjustments, move swaps).

### 📈 Final Team Takeaways
1 paragraph on which of the user's Pokemon performed best, which underperformed, what the team's identity was in this match.

Use emoji section headers as shown above. No code fences, no preamble, no sign-off.`;

async function runBattleLogAnalysis(
  model: ReturnType<typeof createModel>,
  input: PostMatchInput,
): Promise<string> {
  const prompt = buildBattleLogPrompt(input);
  const response = await model.invoke([
    new SystemMessage(BATTLE_LOG_SYSTEM),
    new HumanMessage(prompt),
  ]);
  return flattenContent(response.content);
}

function buildBattleLogPrompt(input: PostMatchInput): string {
  const lines: string[] = [];
  lines.push(`RESULT: ${input.result?.toUpperCase() ?? "unknown"}`);
  lines.push(`MODE: ${input.mode ?? "realtime"}`);
  lines.push(`FORMAT: ${input.format}`);
  lines.push(`OPPONENT NAME: ${input.opponentName || "Unknown"}`);
  if (input.notes) lines.push(`USER'S POST-MATCH NOTES: ${input.notes}`);
  if (input.myTeamDescription) {
    lines.push(`MY TEAM STRATEGY (user-written): ${input.myTeamDescription}`);
  }
  lines.push("");

  lines.push("MY TEAM:");
  for (const p of input.myTeam) {
    lines.push(
      `  • ${p.species} | ${p.ability} | ${p.item} | ${p.nature} | ${p.moves.filter(Boolean).join("/")}`,
    );
  }
  lines.push(`MY BROUGHT-4: ${input.myBrought.join(", ")}`);
  lines.push(`MY LEADS: ${input.myLeads.join(", ")}`);
  lines.push("");

  lines.push("OPPONENT:");
  for (const p of input.opponentTeam) {
    lines.push(
      `  • ${p.species ?? "?"} | ability=${p.ability || "?"} | item=${p.item || "?"}`,
    );
  }
  lines.push(`OPP BROUGHT (as revealed): ${input.opponentBrought.join(", ")}`);
  lines.push(`OPP LEADS: ${input.opponentLeads.join(", ")}`);
  lines.push("");

  if (input.scouting) {
    lines.push("PRE-MATCH SCOUTING:");
    lines.push(`  Archetype: ${input.scouting.archetype}`);
    if (input.scouting.teamSynergies.length) {
      lines.push(`  Synergies: ${input.scouting.teamSynergies.join("; ")}`);
    }
    if (input.scouting.watchFor.length) {
      lines.push(`  Watch for: ${input.scouting.watchFor.join("; ")}`);
    }
    lines.push("");
  }

  lines.push("TURN-BY-TURN ACTIONS:");
  for (const t of input.turns) {
    lines.push(`  Turn ${t.number} — field: ${fmtFieldState(t.fieldState)}`);
    lines.push(`    P1 active: ${fmtActive(t.activeP1)}`);
    lines.push(`    P2 active: ${fmtActive(t.activeP2)}`);
    for (const a of t.actions) {
      lines.push(`    - ${fmtAction(a)}`);
    }
  }
  lines.push("");

  lines.push(
    `FINAL STATE: my fainted=[${input.faintedP1.join(", ") || "none"}] | opp fainted=[${input.faintedP2.join(", ") || "none"}]`,
  );
  if (input.finalActiveP1?.length) {
    lines.push(`  Final P1 active: ${fmtActive(input.finalActiveP1)}`);
  }
  if (input.finalActiveP2?.length) {
    lines.push(`  Final P2 active: ${fmtActive(input.finalActiveP2)}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtFieldState(f: FieldState): string {
  const parts: string[] = [];
  if (f.weather) parts.push(f.weather);
  if (f.terrain) parts.push(`${f.terrain}-terrain`);
  if (f.trickRoom) parts.push("TR");
  if (f.tailwindP1) parts.push("TW(me)");
  if (f.tailwindP2) parts.push("TW(opp)");
  return parts.length ? parts.join(", ") : "clear";
}

function fmtActive(list: ActivePokemon[]): string {
  return list
    .map((p) => {
      const tags: string[] = [`${p.hpPercent}%`];
      if (p.isMega) tags.push("MEGA");
      if (p.status) tags.push(p.status.toUpperCase());
      if (p.itemRemoved) tags.push("itemless");
      const boosts = Object.entries(p.boosts).filter(([, v]) => v !== 0);
      if (boosts.length) tags.push(boosts.map(([k, v]) => `${k}${v > 0 ? "+" : ""}${v}`).join(","));
      return `${p.species} (${tags.join(", ")})`;
    })
    .join("; ");
}

function fmtAction(a: import("@/lib/types/battle").TurnAction): string {
  const who = `${a.side}:${a.slot}`;
  if (a.actionType === "switch") {
    return `${who} switch ${a.switchOutSpecies} → ${a.switchInSpecies}`;
  }
  if (a.actionType === "move" || a.actionType === "mega_move") {
    const parts = [`${who}`];
    if (a.megaEvolved) parts.push("MEGA");
    parts.push(a.moveName ?? "?");
    if (a.targetSide && a.targetSlot) parts.push(`→ ${a.targetSide}:${a.targetSlot}`);
    if (a.damageDealtPercent != null) parts.push(`${a.damageDealtPercent}%`);
    const flags: string[] = [];
    if (a.wasKo) flags.push("KO");
    if (a.wasCriticalHit) flags.push("CRIT");
    if (a.wasMiss) flags.push("MISSED");
    if (a.causedFlinch) flags.push("flinch");
    if (a.inflictedStatus) flags.push(a.inflictedStatus);
    if (a.removedItem) flags.push("KNOCKED OFF");
    if (a.statChanges?.length) {
      flags.push(
        ...a.statChanges.map((sc) => `${sc.side}:${sc.slot} ${sc.stat}${sc.delta > 0 ? "+" : ""}${sc.delta}`),
      );
    }
    if (flags.length) parts.push(`[${flags.join(", ")}]`);
    return parts.join(" ");
  }
  return `${who} ${a.actionType}`;
}

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is { type: "text"; text: string } =>
          typeof b === "object" &&
          b !== null &&
          "type" in b &&
          (b as { type: string }).type === "text" &&
          "text" in b,
      )
      .map((b) => b.text)
      .join("");
  }
  return "";
}

/** Strip accidental code fences the model might wrap the markdown in. */
function stripFences(md: string): string {
  const trimmed = md.trim();
  return trimmed
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}
