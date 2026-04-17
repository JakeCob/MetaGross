/**
 * Synthesizer — LLM-backed lead + watch-for + win-condition builder.
 *
 * Consumes: analyzer output (archetype, synergies, speed control),
 *           researcher output (meta data), predictor output (opponent
 *           sets), plus MY team with FULL movesets.
 *
 * Produces: structured JSON with ranked lead suggestions, watch-fors,
 *           and win conditions. The system prompt enforces a hard
 *           invariant: recommendations must only cite moves that
 *           appear on the user's team. That's the fix for the
 *           hallucination bug ("suggested Fake Out on Froslass" when
 *           Froslass didn't know Fake Out).
 */
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createModel, detectProvider } from "@/lib/ai/graph/model";
import type { ScoutingStateType, ScoutingStateUpdate } from "../state";
import type { SuggestedLead, WinCondition, WinConditionKind } from "../types";
import type { TeamPokemon } from "@/lib/types/pokemon";

function mkId(prefix: string, i: number): string {
  return `${prefix}-${Date.now().toString(36)}-${i}`;
}

const SYSTEM_PROMPT = `You are a high-level VGC doubles matchup synthesizer. You receive:
  - the opponent's predicted team + archetype + synergies
  - MY team with full known movesets, abilities, items
  - any user-written strategy description

Return VALID JSON ONLY — no markdown, no prose outside the object. Schema:

{
  "suggestedLeads": [
    {
      "pair": ["<species1>", "<species2>"],
      "score": <0-100>,
      "rationale": "<1 sentence citing matchup logic>",
      "gamePlan": "<turn 1-2 plan citing ONLY moves the pair actually knows>"
    },
    ...up to 3 entries, ranked best first
  ],
  "watchFor": [
    "<bullet: specific threat/play, 1 sentence each>",
    ...3-5 entries
  ],
  "suggestedWinConditions": [
    {
      "label": "<e.g. 'KO their Archaludon' / 'Land Tailwind turn 1' / 'Keep Incineroar above 50% HP'>",
      "kind": "ko" | "keep-alive" | "move-landed" | "field-state" | "hp-threshold" | "custom",
      "target": { "species": "<if ko/keep-alive/hp-threshold>", "moveName": "<if move-landed>", "fieldEffect": "<if field-state>", "hpPercent": <if hp-threshold>, "byTurn": <optional> }
    },
    ...2-3 entries
  ],
  "synthesis": "<2-3 sentence paragraph summarizing the matchup>"
}

HARD RULES:
1. Leads MUST be two distinct species from MY team. If I have a brought-4 list, prefer those.
2. gamePlan MUST only cite moves that the species actually has in its listed moveset. If a species doesn't know Fake Out, never write "Fake Out." If the pair can't do the play you're proposing, pick a different plan.
3. watchFor is about the OPPONENT's threats — not advice on what I should do.
4. Win-condition "kind" must match the target shape. move-landed needs moveName; ko/keep-alive needs species; hp-threshold needs species + hpPercent; field-state needs fieldEffect.
5. Use the fieldEffect enum literally: "trickRoom" | "tailwindP1" | "tailwindP2" | "rain" | "sun" | "sand" | "snow" | "grassyTerrain" | "electricTerrain" | "psychicTerrain" | "mistyTerrain".
6. No markdown, no code fences, no commentary outside the JSON.`;

export async function synthesizerNode(
  state: ScoutingStateType,
): Promise<Partial<ScoutingStateUpdate>> {
  const userPrompt = buildUserPrompt(state);
  const provider = detectProvider();
  const model = createModel(provider);

  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(userPrompt),
  ]);

  const text = flattenContent(response.content);
  const parsed = parseJsonLoose(text);

  const suggestedLeads = coerceLeads(parsed?.suggestedLeads, state.myTeam);
  const watchFor = coerceStringArray(parsed?.watchFor);
  const suggestedWinConditions = coerceWinConditions(
    parsed?.suggestedWinConditions,
  );
  const synthesis =
    typeof parsed?.synthesis === "string" ? parsed.synthesis : "";

  return {
    suggestedLeads,
    watchFor,
    suggestedWinConditions,
    synthesis,
    history: [
      {
        source: "synthesizer",
        summary: `leads=${suggestedLeads.length}, watchFor=${watchFor.length}, winConds=${suggestedWinConditions.length}`,
        at: Date.now(),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function buildUserPrompt(state: ScoutingStateType): string {
  const lines: string[] = [];

  // --- MY TEAM ---
  lines.push("MY TEAM (★ = brought-4):");
  const brSet = new Set(state.myBrought);
  for (const p of state.myTeam) {
    const tag = brSet.has(p.species) ? "★" : " ";
    const moves = p.moves.filter(Boolean).join(" / ") || "(no moves listed)";
    lines.push(
      `  ${tag} ${p.species} | ability=${p.ability || "?"} | item=${p.item || "?"} | nature=${p.nature} | moves=[${moves}]`,
    );
  }
  if (state.myTeamDescription.trim()) {
    lines.push("");
    lines.push(`MY STRATEGY (user-written): ${state.myTeamDescription.trim()}`);
  }
  lines.push("");

  // --- OPPONENT ---
  lines.push("OPPONENT TEAM (predicted sets):");
  for (const pred of state.predictions) {
    const moves = pred.moves.filter(Boolean).join(" / ") || "?";
    lines.push(
      `  • ${pred.species} (conf ${Math.round(pred.confidence * 100)}%) | ability=${pred.ability || "?"} | item=${pred.item || "?"} | nature=${pred.nature} | moves=[${moves}]`,
    );
  }
  lines.push(`ARCHETYPE: ${state.archetype || "unknown"}`);
  if (state.teamSynergies.length) {
    lines.push(`SYNERGIES: ${state.teamSynergies.join("; ")}`);
  }
  if (state.speedControl.length) {
    lines.push(`SPEED CONTROL: ${state.speedControl.join(", ")}`);
  }
  lines.push("");

  lines.push(
    "Based ONLY on the movesets above, produce the JSON. Remember: never cite a move that isn't on the pair's actual movesets.",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Output coercion
// ---------------------------------------------------------------------------

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
    return JSON.parse(withoutFence.slice(first, last + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

/**
 * Validate leads against MY team — drop anything where the species
 * doesn't match, and scrub gamePlan mentions of moves the pair doesn't
 * know. This is the last-line defense against LLM hallucination.
 */
function coerceLeads(
  raw: unknown,
  myTeam: TeamPokemon[],
): SuggestedLead[] {
  if (!Array.isArray(raw)) return [];

  const teamSet = new Set(myTeam.map((p) => p.species.toLowerCase()));
  const moveMap = new Map<string, Set<string>>();
  for (const p of myTeam) {
    moveMap.set(
      p.species.toLowerCase(),
      new Set(p.moves.filter(Boolean).map((m) => m.toLowerCase())),
    );
  }

  const out: SuggestedLead[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const pair = r.pair;
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const a = String(pair[0] ?? "").trim();
    const b = String(pair[1] ?? "").trim();
    if (!a || !b || a === b) continue;
    if (!teamSet.has(a.toLowerCase()) || !teamSet.has(b.toLowerCase())) {
      // Species not on my team — LLM hallucinated. Drop this lead.
      continue;
    }

    const score =
      typeof r.score === "number" ? Math.max(0, Math.min(100, Math.round(r.score))) : 50;
    const rationale = typeof r.rationale === "string" ? r.rationale : "";
    let gamePlan = typeof r.gamePlan === "string" ? r.gamePlan : "";

    // Flag any move name in the plan that isn't on the pair's actual
    // movesets. Append a warning instead of silently dropping the plan
    // so the user can see what the LLM tried to do.
    const movesAvailable = new Set<string>([
      ...(moveMap.get(a.toLowerCase()) ?? new Set<string>()),
      ...(moveMap.get(b.toLowerCase()) ?? new Set<string>()),
    ]);
    const hallucinated = findHallucinatedMoves(gamePlan, movesAvailable);
    if (hallucinated.length > 0) {
      gamePlan += ` ⚠ (AI cited move${hallucinated.length > 1 ? "s" : ""} not on this pair: ${hallucinated.join(", ")})`;
    }

    out.push({ pair: [a, b], score, rationale, gamePlan });
  }
  return out.slice(0, 3);
}

/**
 * Heuristic: scan the gamePlan text for capitalised move names that
 * aren't in the pair's movesets. We don't try to be exhaustive — just
 * catch common flags like "Fake Out", "Taunt", "Protect", "Tailwind",
 * "Trick Room", etc.
 */
function findHallucinatedMoves(
  plan: string,
  movesAvailable: Set<string>,
): string[] {
  const COMMON_MOVES = [
    "Fake Out", "Protect", "Taunt", "Tailwind", "Trick Room", "Rain Dance",
    "Sunny Day", "Snowscape", "Icy Wind", "Thunder Wave", "Will-O-Wisp",
    "Swords Dance", "Nasty Plot", "Helping Hand", "Follow Me", "Rage Powder",
    "Spore", "Sleep Powder", "Substitute", "Recover", "Roost", "Ally Switch",
    "Fake Tears", "Snarl", "Parting Shot", "U-turn", "Volt Switch",
    "Earthquake", "Rock Slide", "Dazzling Gleam", "Hyper Voice", "Heat Wave",
    "Blizzard", "Muddy Water", "Flare Blitz", "Knock Off", "Close Combat",
    "Eruption", "Draco Meteor", "Sucker Punch", "Aqua Jet", "Extreme Speed",
    "Scald", "Surf", "Aura Sphere",
    // Forced-switch tools — critical against Trick Room / setup setters.
    "Dragon Tail", "Roar", "Whirlwind", "Circle Throw",
    // Priority / pivoting / disruption the LLM loves to cite.
    "Quick Attack", "Bullet Punch", "Ice Shard", "Mach Punch",
    "Encore", "Disable", "Haze", "Clear Smog",
  ];
  const found: string[] = [];
  const lower = plan.toLowerCase();
  for (const m of COMMON_MOVES) {
    if (lower.includes(m.toLowerCase()) && !movesAvailable.has(m.toLowerCase())) {
      found.push(m);
    }
  }
  return found;
}

function coerceStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, 6);
}

const ALLOWED_KINDS: WinConditionKind[] = [
  "ko",
  "keep-alive",
  "move-landed",
  "field-state",
  "hp-threshold",
  "custom",
];

function coerceWinConditions(raw: unknown): WinCondition[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const out: WinCondition[] = [];
  for (let i = 0; i < raw.length && out.length < 4; i++) {
    const r = raw[i];
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label : "";
    const kind = ALLOWED_KINDS.includes(obj.kind as WinConditionKind)
      ? (obj.kind as WinConditionKind)
      : "custom";
    if (!label) continue;
    const target =
      obj.target && typeof obj.target === "object"
        ? (obj.target as WinCondition["target"])
        : undefined;
    out.push({
      id: mkId("wc", i),
      label,
      kind,
      target,
      status: "pending",
      checkable: kind !== "custom",
      source: "agent",
      createdAt: now,
    });
  }
  return out;
}
